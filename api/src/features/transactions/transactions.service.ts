import { Injectable } from '@nestjs/common';

import { asAddress, getTransactionSatisfiability, Hex, isHex, isPresent } from 'lib';
import e from '~/edgeql-js';
import { ShapeFunc } from '../database/database.select';
import { DatabaseService } from '../database/database.service';
import { policyStateAsPolicy, policyStateShape } from '../policies/policies.util';
import { UniqueProposal } from '../proposals/proposals.service';
import {
  proposalTxShape,
  transactionProposalAsTx,
} from '../transaction-proposals/transaction-proposals.util';

@Injectable()
export class TransactionsService {
  constructor(private db: DatabaseService) {}

  async selectUnique(txHash: Hex, shape?: ShapeFunc<typeof e.Transaction>) {
    return this.db.query(
      e.select(e.Transaction, (t) => ({
        filter_single: { hash: txHash },
        ...shape?.(t),
      })),
    );
  }

  async satisfiablePolicies(id: UniqueProposal) {
    const proposal = await this.db.query(
      e.select(e.TransactionProposal, (p) => ({
        filter_single: isHex(id) ? { hash: id } : { id },
        ...proposalTxShape(p),
        approvals: {
          approver: { address: true },
        },
        rejections: {
          approver: { address: true },
        },
        account: {
          id: true,
          policies: {
            key: true,
            state: policyStateShape,
          },
        },
      })),
    );
    if (!proposal) throw new Error(`Proposal ${id} not found`);

    const tx = transactionProposalAsTx(proposal);

    const approvals = new Set(proposal.approvals.map((a) => asAddress(a.approver.address)));
    const rejections = new Set(proposal.rejections.map((a) => asAddress(a.approver.address)));

    const policies = proposal.account.policies
      .map((policy) => policyStateAsPolicy(policy.key, policy.state))
      .filter(isPresent)
      .map((policy) => ({
        policy,
        satisfiability: getTransactionSatisfiability(policy, tx, approvals),
      }));

    return { accountId: proposal.account.id, policies, approvals, rejections };
  }
}
