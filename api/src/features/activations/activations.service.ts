import { Injectable } from '@nestjs/common';
import { ActivationsQueue } from './activations.queue';
import { QueueData } from '../util/bull/bull.util';
import {
  ACCOUNT_PROXY_FACTORY,
  UAddress,
  asAddress,
  asChain,
  asHex,
  deployAccountProxyRequest,
  isPresent,
  simulateDeployAccountProxy,
  DeployAccountProxyRequestParams,
} from 'lib';
import { NetworksService } from '../util/networks/networks.service';
import e from '~/edgeql-js';
import { DatabaseService } from '../database/database.service';
import { policyStateAsPolicy, policyStateShape } from '../policies/policies.util';
import { FlowJob } from 'bullmq';
import { TransactionsQueue } from '../transactions/transactions.queue';
import Decimal from 'decimal.js';

interface FeeParams {
  address: UAddress;
  feePerGas: Decimal;
  use: boolean;
}

@Injectable()
export class ActivationsService {
  constructor(
    private db: DatabaseService,
    private networks: NetworksService,
  ) {}

  activationFlow(account: UAddress) {
    return {
      queueName: TransactionsQueue.name,
      name: 'Activation transaction',
      data: {
        chain: asChain(account),
        transaction: 'child',
      } satisfies QueueData<TransactionsQueue>,
      children: [
        {
          queueName: ActivationsQueue.name,
          name: 'Activation',
          data: { account } satisfies QueueData<typeof ActivationsQueue>,
        },
      ],
    } satisfies FlowJob;
  }

  async simulate(address: UAddress) {
    const params = await this.params(address);
    if (!params) return null;

    const network = this.networks.get(address);
    return (await simulateDeployAccountProxy({ network, ...params }))._unsafeUnwrap();
  }

  async fee({ address, feePerGas, use }: FeeParams): Promise<Decimal | null> {
    const a = await this.db.query(
      e.select(e.Account, () => ({
        filter_single: { address },
        isActive: true,
        activationEthFee: true,
      })),
    );
    if (!a) return null;

    if (a.activationEthFee) {
      if (use) {
        await this.db.query(
          e.update(e.Account, () => ({
            filter_single: { address },
            set: { activationEthFee: null },
          })),
        );
      }

      return new Decimal(a.activationEthFee);
    }

    const gas = await this.estimateGas(address);
    return gas ? feePerGas.mul(gas.toString()) : null;
  }

  private async estimateGas(address: UAddress): Promise<bigint | null> {
    const params = await this.params(address);
    if (!params) return null;

    const network = this.networks.get(address);
    return network.estimateContractGas({
      account: asAddress(network.walletAddress),
      ...deployAccountProxyRequest(params),
    });
  }

  async params(address: UAddress) {
    const account = await this.db.query(
      e.select(e.Account, (a) => ({
        filter_single: { address },
        isActive: true,
        implementation: true,
        salt: true,
        initPolicies: e.select(a.policies, (p) => ({
          filter: p.state.isAccountInitState,
          key: true,
          state: policyStateShape,
        })),
      })),
    );
    if (!account) throw new Error(`Account ${address} not found`);
    if (account.isActive) return null;

    return {
      factory: ACCOUNT_PROXY_FACTORY.address[asChain(address)],
      salt: asHex(account.salt),
      implementation: asAddress(account.implementation),
      policies: account.initPolicies
        .map((p) => policyStateAsPolicy(p.key, p.state))
        .filter(isPresent),
    } satisfies DeployAccountProxyRequestParams;
  }
}
