import { Injectable } from '@nestjs/common';
import { EventsWorker, EventData, Log } from '../events/events.worker';
import { ACCOUNT_ABI, Hex, PolicyKey, asPolicyKey, asUAddress, asUUID } from 'lib';
import { Chain } from 'chains';
import { DatabaseService } from '~/core/database';
import { getAbiItem } from 'viem';
import { activatePolicy } from './activate-policy.query';
import { PoliciesService } from './policies.service';
import { PolicyEvent } from './policies.model';
import { TransactionsService } from '../transactions/transactions.service';

const policyAddedEvent = getAbiItem({ abi: ACCOUNT_ABI, name: 'PolicyAdded' });
const policyRemovedEvent = getAbiItem({ abi: ACCOUNT_ABI, name: 'PolicyRemoved' });

@Injectable()
export class PoliciesEventsProcessor {
  constructor(
    private db: DatabaseService,
    private events: EventsWorker,
    private policies: PoliciesService,
    private transactions: TransactionsService,
  ) {
    this.events.on(policyAddedEvent, (data) => this.policyAdded(data));
    this.events.on(policyRemovedEvent, (data) => this.policyRemoved(data));
  }

  private async policyAdded({ chain, log }: EventData<typeof policyAddedEvent>) {
    const { account, new: policyId } = await this.markStateAsActive(
      chain,
      log,
      asPolicyKey(log.args.key),
      log.args.hash,
    );

    if (policyId)
      this.policies.event({ event: PolicyEvent.created, account, policyId: asUUID(policyId) });
  }

  private async policyRemoved({ chain, log }: EventData<typeof policyRemovedEvent>) {
    const { account, old: policyId } = await this.markStateAsActive(
      chain,
      log,
      asPolicyKey(log.args.key),
    );

    if (policyId)
      this.policies.event({ event: PolicyEvent.removed, account, policyId: asUUID(policyId) });
  }

  private async markStateAsActive(chain: Chain, log: Log, key: PolicyKey, hash?: Hex) {
    const account = asUAddress(log.address, chain);
    const r = await this.db.exec(activatePolicy, {
      account,
      key,
      hash,
      activationBlock: log.blockNumber,
    });

    await Promise.all(r.pendingTransactions.map((id) => this.transactions.tryExecute(asUUID(id))));

    if (!r.new) {
      // TODO: this shouldn't happen
    }

    return { account, old: r.old, new: r.new };
  }
}
