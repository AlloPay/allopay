import { Injectable } from '@nestjs/common';
import { decodeEventLog, getAbiItem, Log } from 'viem';

import { Chain } from 'chains';
import { ACCOUNT_ABI, asHex, asPolicyKey, asUAddress, PolicyKey } from 'lib';
import e from '~/edgeql-js';
import { DatabaseService } from '../database/database.service';
import { and } from '../database/database.util';
import { EventData, EventsWorker } from '../events/events.worker';
import { selectPolicy } from './policies.util';

@Injectable()
export class PoliciesEventsProcessor {
  constructor(
    private db: DatabaseService,
    private events: EventsWorker,
  ) {
    this.events.on(getAbiItem({ abi: ACCOUNT_ABI, name: 'PolicyAdded' }), (data) =>
      this.policyAdded(data),
    );
    this.events.on(getAbiItem({ abi: ACCOUNT_ABI, name: 'PolicyRemoved' }), (data) =>
      this.policyRemoved(data),
    );
  }

  private async policyAdded({ chain, log }: EventData) {
    const r = decodeEventLog({ abi: ACCOUNT_ABI, ...log, eventName: 'PolicyAdded' });

    await this.markStateAsActive(chain, log, asPolicyKey(r.args.key));
  }

  private async policyRemoved({ chain, log }: EventData) {
    const r = decodeEventLog({ abi: ACCOUNT_ABI, ...log, eventName: 'PolicyRemoved' });

    await this.markStateAsActive(chain, log, asPolicyKey(r.args.key));
  }

  private async markStateAsActive(chain: Chain, log: Log, key: PolicyKey) {
    // TODO: filter state by state hash (part of event log) to ensure correct state is activated
    // It's possible that two policies are activated in the same proposal; it's not prohibited by a constraint.
    await this.db.query(
      e.update(e.PolicyState, (ps) => ({
        filter: and(
          e.op(ps.policy, '=', selectPolicy({ account: asUAddress(log.address, chain), key })),
          e.op(
            e.op(
              ps.proposal,
              '?=', // Returns {false} rather than {} if one doesn't exist
              e.select(e.Transaction, () => ({
                filter_single: { hash: asHex(log.transactionHash!) },
                proposal: { id: true },
              })).proposal,
            ),
            'or',
            ps.isAccountInitState,
          ),
        ),
        set: {
          activationBlock: log.blockNumber,
        },
      })),
    );
  }
}
