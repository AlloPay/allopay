import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SpendingInput, TokensInput, UpsertTokenInput } from './tokens.input';
import { Scope, Shape, ShapeFunc } from '../database/database.select';
import e, { $infer } from '~/edgeql-js';
import { uuid } from 'edgedb/dist/codecs/ifaces';
import { UAddress, asAddress, asDecimal, asFp, asUAddress, isUAddress } from 'lib';
import { ERC20, TOKENS, flattenToken } from 'lib/dapps';
import { and, or } from '../database/database.util';
import { NetworksService } from '../util/networks/networks.service';
import { UserInputError } from '@nestjs/apollo';
import { OrderByObjExpr } from '~/edgeql-js/select';
import { TokenMetadata } from '~/features/tokens/tokens.model';
import Decimal from 'decimal.js';
import { selectAccount } from '../accounts/accounts.util';
import { TokenSpending } from './spending.model';
import { Transferlike } from '../transfers/transfers.model';

export const SPENDING_SHAPE = { address: true } satisfies Shape<typeof e.Token>;
const _selectSpending = e.select(e.Token, () => SPENDING_SHAPE);
export type SpendingDeps = $infer<typeof _selectSpending>[0];

@Injectable()
export class TokensService {
  private decimalsCache = new Map<UAddress, number>(
    TOKENS.flatMap(flattenToken).map((t) => [t.address, t.decimals]),
  );
  constructor(
    private db: DatabaseService,
    private networks: NetworksService,
  ) {}

  async selectUnique(id: uuid | UAddress, shape?: ShapeFunc<typeof e.Token>) {
    return this.db.query(
      e.assert_single(
        e.select(e.Token, (t) => ({
          filter: isUAddress(id) ? e.op(t.address, '=', id) : e.op(t.id, '=', e.uuid(id)),
          limit: 1,
          order_by: preferUserToken(t),
          ...shape?.(t),
        })),
      ),
    );
  }

  async select(
    { address, query, feeToken, chain }: TokensInput = {},
    shape?: ShapeFunc<typeof e.Token>,
  ) {
    const tokens = await this.db.query(
      e.select(e.Token, (t) => ({
        ...shape?.(t),
        address: true,
        filter: and(
          address && address.length > 0 && e.op(t.address, 'in', e.set(...address)),
          query &&
            or(
              e.op(t.address, 'ilike', query),
              e.op(t.name, 'ilike', query),
              e.op(t.symbol, 'ilike', query),
            ),
          feeToken !== undefined && e.op(t.isFeeToken, '=', feeToken),
          chain && e.op(t.chain, '=', chain),
        ),
        order_by: [
          {
            expression: t.address,
            direction: e.ASC,
          },
          preferUserToken(t),
        ],
      })),
    );

    // Filter out duplicate allowlisted (no user) tokens
    return tokens.filter((t, i) => i === 0 || t.address !== tokens[i - 1].address);
  }

  async upsert(token: UpsertTokenInput) {
    const metadata = await this.getTokenMetadata(token.address);

    const c = {
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      ...token,
    };
    if (!c.name) throw new UserInputError('Name could not be detected so is required');
    if (!c.symbol) throw new UserInputError('Symbol could not be detected so is required');
    if (c.decimals === undefined)
      throw new UserInputError('Symbol could not be detected so is required');

    return this.db.query(
      e
        .insert(e.Token, {
          ...c,
          name: c.name,
          symbol: c.symbol,
          decimals: c.decimals,
        })
        .unlessConflict((t) => ({
          on: e.tuple([t.user, t.address]),
          else: e.update(t, () => ({ set: token })),
        })),
    );
  }

  async remove(address: UAddress) {
    return this.db.query(
      e.delete(e.Token, () => ({
        filter_single: { address, user: e.global.current_user },
      })).id,
    );
  }

  async getTokenMetadata(address: UAddress) {
    const t = await this.db.query(
      e.assert_single(
        e.select(e.Token, (t) => ({
          filter: e.op(e.op(t.address, '=', address), 'and', e.op('not', e.op('exists', t.user))),
          limit: 1,
          ethereumAddress: true,
          name: true,
          symbol: true,
          decimals: true,
          isFeeToken: true,
          iconUri: true,
        })),
      ),
    );
    if (t) return t;

    const [name, symbol, decimals] = await this.networks.get(address).multicall({
      contracts: [
        {
          abi: ERC20,
          address: asAddress(address),
          functionName: 'name',
        },
        {
          abi: ERC20,
          address: asAddress(address),
          functionName: 'symbol',
        },
        {
          abi: ERC20,
          address: asAddress(address),
          functionName: 'decimals',
        },
      ],
    });

    return {
      id: `TokenMetadata:${address}`,
      name: name.result,
      symbol: symbol.result,
      decimals: decimals.result,
      iconUri: null,
    } satisfies TokenMetadata;
  }

  async decimals(token: UAddress): Promise<number> {
    const cached = this.decimalsCache.get(token);
    if (cached !== undefined) return cached;

    const decimals = await this.networks.get(token).readContract({
      address: asAddress(token),
      abi: ERC20,
      functionName: 'decimals',
    });
    this.decimalsCache.set(token, decimals);

    return decimals;
  }

  async asDecimal(token: UAddress, amount: bigint): Promise<Decimal> {
    return asDecimal(amount, await this.decimals(token));
  }

  async asFp(token: UAddress, amount: Decimal): Promise<bigint> {
    return asFp(amount, await this.decimals(token));
  }

  async spending(
    input: SpendingInput,
    { address: token }: SpendingDeps,
    shape?: ShapeFunc,
  ): Promise<TokenSpending> {
    if (input.policyKey === undefined && !input.duration)
      throw new UserInputError('policyKey or duration is required');

    const policy = e.select(e.Policy, (p) => ({
      filter: and(
        e.op(p.account, '=', selectAccount(input.account)),
        input.policyKey !== undefined && e.op(p.key, '=', input.policyKey),
      ),
    }));
    // May technically be multiple, but only used when there's one (when policyKey is provided)
    const limit = e.assert_single(
      e.select(policy.state.transfers.limits, (l) => ({
        filter: e.op(l.token, '=', asAddress(token)),
        amount: true,
        duration: true,
      })),
    );
    const durationSeconds = e.assert_exists(
      input.duration ? e.uint32(input.duration) : limit.duration,
    );
    const oldest = e.op(
      e.datetime_of_transaction(),
      '-',
      e.to_duration({ seconds: durationSeconds }),
    );
    const systxs = e.select(policy['<policy[is Transaction]'].systxs, (t) => ({
      filter: e.op(t.timestamp, '>', oldest),
    }));
    const transfers = e.select(systxs.events.is(e.Transferlike), (t) => ({
      filter: and(
        e.op(t.tokenAddress, '=', asUAddress(token)),
        e.op(e.TransferDirection.Out, 'in', t.direction),
      ),
      ...shape?.(t, 'transfers'),
    }));

    const r = await this.db.query(
      e.select({
        transfers: shape?.includes?.('transfers') ? transfers : e.cast(e.Transfer, e.set()),
        spent: e.op(e.sum(transfers.amount), '*', e.decimal('-1')),
        limit_: limit,
        durationSeconds: e.select(durationSeconds),
      }),
    );

    const spent = new Decimal(r.spent);
    const limit_ = r.limit_ ? await this.asDecimal(asUAddress(token), r.limit_.amount) : undefined;

    return {
      transfers: r.transfers as Transferlike[],
      duration: r.durationSeconds,
      spent,
      limit: limit_,
      remaining: limit_ ? limit_.minus(spent) : undefined,
    };
  }
}

export function preferUserToken(t: Scope<typeof e.Token>): OrderByObjExpr {
  return {
    expression: e.op('exists', t.user),
    direction: e.DESC,
  };
}
