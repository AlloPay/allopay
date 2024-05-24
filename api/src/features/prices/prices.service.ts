import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Hex, UAddress, asHex, filterAsync, decodeRevertError, isUAddress, asUAddress } from 'lib';
import { Price } from './prices.model';
import e from '~/edgeql-js';
import { preferUserToken } from '~/features/tokens/tokens.service';
import { DatabaseService } from '~/features/database/database.service';
import { EvmPriceServiceConnection, PriceFeed } from '@pythnetwork/pyth-evm-js';
import { CONFIG } from '~/config';
import { DateTime } from 'luxon';
import { ETH, PYTH } from 'lib/dapps';
import { CHAINS, Chain } from 'chains';
import Decimal from 'decimal.js';
import { NetworksService } from '~/features/util/networks/networks.service';
import Redis from 'ioredis';
import { InjectRedis } from '@songkeys/nestjs-redis';
import { runExclusively } from '~/util/mutex';
import { and } from '#/database/database.util';

interface PriceData {
  current: Decimal;
  ema: Decimal;
}

@Injectable()
export class PricesService implements OnModuleInit {
  private log = new Logger(this.constructor.name);
  private pyth: EvmPriceServiceConnection;
  private usdPrices = new Map<Hex, PriceData>();
  private lastOnchainPublishTime = Object.keys(CHAINS).reduce(
    (acc, chain) => ({
      ...acc,
      [chain]: new Map<Hex, DateTime>(),
    }),
    {} as Record<Chain, Map<Hex, DateTime>>,
  );
  private systemTokenPriceIds = new Map<UAddress, Hex>();

  constructor(
    private db: DatabaseService,
    private networks: NetworksService,
    @InjectRedis() private redis: Redis,
  ) {
    this.pyth = new EvmPriceServiceConnection(CONFIG.pythHermesUrl);
    this.pyth.onWsError = (e) => this.handlePythWsError(e);
  }

  onModuleInit() {
    this.initSystemToken();
  }

  async price(tokenOrUsdPriceId: Hex | UAddress): Promise<Price> {
    const tokenPriceId = isUAddress(tokenOrUsdPriceId)
      ? await this.getUsdPriceId(tokenOrUsdPriceId)
      : tokenOrUsdPriceId;

    const [ethUsd, tokenUsd] = await Promise.all([
      this.usd(ETH.pythUsdPriceId),
      this.usd(tokenPriceId),
    ]);
    if (!ethUsd || !tokenUsd) throw new Error(`Failed to get pricefeed for ${tokenPriceId}`);

    return {
      id: tokenPriceId,
      usd: tokenUsd.current,
      usdEma: tokenUsd.ema,
      eth: tokenUsd.current.div(ethUsd.current),
      ethEma: tokenUsd.ema.div(ethUsd.ema),
    };
  }

  async usd(priceId: Hex): Promise<PriceData | null> {
    const cached = this.usdPrices.get(priceId);
    if (cached) return cached;

    const [feed] = (await this.pyth.getLatestPriceFeeds([priceId])) ?? [];
    if (!feed) return null;

    const r = this.getPriceDataFromFeed(feed);
    if (r) {
      // Cache result and subscribe to keep cache fresh
      this.usdPrices.set(priceId, r);

      this.pyth.subscribePriceFeedUpdates([priceId], (feed) => {
        const newPrice = this.getPriceDataFromFeed(feed);
        if (newPrice) this.usdPrices.set(priceId, newPrice);
      });
    }

    return r;
  }

  private getPriceDataFromFeed(feed: PriceFeed): PriceData | null {
    const expiryTimestamp = Math.ceil(this.expiry.toSeconds());

    const currentData = feed.getPriceNoOlderThan(expiryTimestamp);
    const emaData = feed.getEmaPriceNoOlderThan(expiryTimestamp);
    if (!currentData || !emaData) return null;

    return {
      current: new Decimal(currentData.price).mul(new Decimal(10).pow(currentData.expo)),
      ema: new Decimal(emaData.price).mul(new Decimal(10).pow(emaData.expo)),
    };
  }

  private async getUsdPriceId(token: UAddress) {
    const cached = this.systemTokenPriceIds.get(token);
    if (cached) return cached;

    const usdPriceId = await this.db.query(
      e.assert_single(
        e.select(e.Token, (t) => ({
          filter: e.op(t.address, '=', token),
          limit: 1,
          order_by: preferUserToken(t),
          pythUsdPriceId: true,
        })).pythUsdPriceId,
      ),
    );
    if (!usdPriceId) throw new Error(`Failed to get price id for ${token}`);

    return asHex(usdPriceId);
  }

  async updatePriceFeedsIfNecessary(chain: Chain, priceIds: Hex[]) {
    priceIds = [...new Set(priceIds)];

    // No need to update ETH/USD if it's the only required pricefeed; all fees are priced in ETH, so ETH/USD is only used when converting from token -> ETH
    if (priceIds.length === 1 && priceIds[0] === ETH.pythUsdPriceId) return;

    if (
      priceIds
        .map((priceId) => this.isPriceFeedGuaranteedFresh(chain, priceId))
        .every((fresh) => fresh)
    )
      return;

    await runExclusively(
      async () => {
        const expiredPriceIds = await filterAsync(
          priceIds,
          async (priceId) => !(await this.checkPriceFeedFresh(chain, priceId)),
        );
        if (expiredPriceIds.length === 0) return;

        const updateData = (await this.pyth.getPriceFeedsUpdateData(expiredPriceIds)).map(asHex);

        const network = this.networks.get(chain);
        const updateFee = await network.readContract({
          abi: PYTH.abi,
          address: PYTH.address[chain],
          functionName: 'getUpdateFee',
          args: [updateData],
        });

        const sim = await network.simulateContract({
          abi: PYTH.abi,
          address: PYTH.address[chain],
          functionName: 'updatePriceFeeds',
          args: [updateData],
          value: updateFee,
        });

        const transactionHash = await network.useWallet(
          async (wallet) => await wallet.writeContract(sim.request),
        );
        await network.waitForTransactionReceipt({ hash: transactionHash });

        this.log.debug(`${chain}: updated pricefeeds ${expiredPriceIds.join(', ')}`);
      },
      {
        redis: this.redis,
        key: priceIds.map((priceId) => `prices.updatePricefeed:${chain}:${priceId}`),
      },
    );
  }

  private isPriceFeedGuaranteedFresh(chain: Chain, priceId: Hex): boolean {
    // Publish times can never go backwards, so our cache can never have false positives, but may have false negatives
    const publishTime = this.lastOnchainPublishTime[chain].get(priceId);
    return !!publishTime && publishTime > this.expiry;
  }

  async checkPriceFeedFresh(chain: Chain, priceId: Hex): Promise<boolean> {
    if (this.isPriceFeedGuaranteedFresh(chain, priceId)) return true;

    try {
      const p = await this.networks.get(chain).readContract({
        abi: PYTH.abi,
        address: PYTH.address[chain],
        functionName: 'getPriceUnsafe',
        args: [priceId],
      });

      const publishTime = DateTime.fromSeconds(Number(p.publishTime));
      this.lastOnchainPublishTime[chain].set(priceId, publishTime);

      return publishTime > this.expiry;
    } catch (error) {
      const e = decodeRevertError({ error, abi: PYTH.abi });
      if (e?.errorName === 'PriceFeedNotFound') {
        // PriceFeedNotFound also occurs if it is not pushed on-chain yet
        this.lastOnchainPublishTime[chain].set(priceId, DateTime.fromSeconds(0));
        return false;
      }
      throw error;
    }
  }

  private handlePythWsError(error: Error) {
    this.log.error(error);

    // Force disconnect
    this.pyth.closeWebSocket();

    // Reconnect
    this.pyth.startWebSocket();
    this.usdPrices.clear(); // Clear cache in order to re-establish subscriptions
  }

  private get expiry() {
    // Paymaster allows prices no older than *60 minutes*
    return DateTime.now().minus({ minutes: 59 });
  }

  private async initSystemToken() {
    const r = await this.db.query(
      e.select(e.Token, (t) => ({
        filter: and(t.isSystem, e.op('exists', t.pythUsdPriceId)),
        address: true,
        pythUsdPriceId: true,
      })),
    );

    this.systemTokenPriceIds = new Map(
      r.map((v) => [asUAddress(v.address), asHex(v.pythUsdPriceId!)] as const),
    );

    this.systemTokenPriceIds.forEach((priceId) => this.usd(priceId));
  }
}
