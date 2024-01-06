import { Revenue } from '@amplitude/analytics-node';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRedis } from '@songkeys/nestjs-redis';
import Decimal from 'decimal.js';
import Redis from 'ioredis';
import { decodeEventLog, getAbiItem } from 'viem';

import {
  ACCOUNT_IMPLEMENTATION,
  asChain,
  asDecimal,
  asHex,
  asUAddress,
  asUUID,
  Hex,
  isTruthy,
  tryOrCatch,
} from 'lib';
import { ETH } from 'lib/dapps';
import e from '~/edgeql-js';
import { ampli } from '~/util/ampli';
import { runOnce } from '~/util/mutex';
import { DatabaseService } from '../database/database.service';
import { and } from '../database/database.util';
import { ProposalEvent } from '../proposals/proposals.input';
import { ProposalsService } from '../proposals/proposals.service';
import { RUNNING_JOB_STATUSES, TypedQueue } from '../util/bull/bull.util';
import { NetworksService } from '../util/networks/networks.service';
import { TRANSACTIONS_QUEUE } from './transactions.queue';
import { TransactionData, TransactionEventData, TransactionsWorker } from './transactions.worker';

@Injectable()
export class TransactionsEvents implements OnModuleInit {
  private log = new Logger(this.constructor.name);

  constructor(
    @InjectQueue(TRANSACTIONS_QUEUE.name)
    private queue: TypedQueue<typeof TRANSACTIONS_QUEUE>,
    private db: DatabaseService,
    @InjectRedis() private redis: Redis,
    private networks: NetworksService,
    private transactionsProcessor: TransactionsWorker,
    private proposals: ProposalsService,
  ) {
    this.transactionsProcessor.onEvent(
      getAbiItem({ abi: ACCOUNT_IMPLEMENTATION.abi, name: 'OperationExecuted' }),
      (data) => this.executed(data),
    );
    this.transactionsProcessor.onEvent(
      getAbiItem({ abi: ACCOUNT_IMPLEMENTATION.abi, name: 'OperationsExecuted' }),
      (data) => this.executed(data),
    );
    this.transactionsProcessor.onTransaction((data) => this.reverted(data));
  }

  onModuleInit() {
    this.addMissingJobs();
  }

  private async executed({ chain, log, receipt, block }: TransactionEventData) {
    const r = tryOrCatch(
      () =>
        decodeEventLog({
          abi: ACCOUNT_IMPLEMENTATION.abi,
          topics: log.topics as [Hex, ...Hex[]],
          data: log.data as Hex,
        }),
      (e) => {
        this.log.warn(`Failed to decode executed event log: ${e}`);
      },
    );
    if (r?.eventName !== 'OperationExecuted' && r?.eventName !== 'OperationsExecuted') return;

    const updatedTransaction = e.update(e.Transaction, () => ({
      filter_single: { hash: asHex(receipt.transactionHash) },
      set: {
        receipt: e.insert(e.Receipt, {
          success: true,
          responses: 'responses' in r.args ? [...r.args.responses] : [r.args.response],
          gasUsed: receipt.gasUsed,
          ethFeePerGas: asDecimal(receipt.effectiveGasPrice, ETH).toString(),
          block: BigInt(receipt.blockNumber),
          timestamp: new Date(Number(block.timestamp) * 1000), // block.timestamp is in seconds
        }),
      },
    }));

    const transaction = await this.db.query(
      e.select(updatedTransaction, () => ({
        proposal: {
          id: true,
          account: { approvers: { user: true } },
          paymasterEthFee: true,
        },
        ethPerFeeToken: true,
        usdPerFeeToken: true,
      })),
    );
    if (!transaction)
      throw new Error(`Transaction not found for executed transaction: ${receipt.transactionHash}`);

    const proposal = transaction.proposal;
    this.log.debug(`Proposal executed: ${proposal.id}`);

    await this.proposals.publishProposal(
      { id: asUUID(proposal.id), account: asUAddress(receipt.from, chain) },
      ProposalEvent.executed,
    );

    const usdPerEth = new Decimal(transaction.usdPerFeeToken).div(transaction.ethPerFeeToken);
    const revenue = new Decimal(transaction.proposal.paymasterEthFee).mul(usdPerEth).toNumber();
    proposal.account.approvers.forEach(({ user }) => {
      ampli.transactionExecuted(user.id, { success: false }, { revenue });
    });
  }

  private async reverted({ chain, receipt, block }: TransactionData) {
    if (receipt.status !== 'reverted') return;

    const network = this.networks.get(chain);
    const tx = await network.getTransaction({ hash: receipt.transactionHash });
    const callResponse = await network.call(tx);

    const updatedTransaction = e.update(e.Transaction, () => ({
      filter_single: { hash: asHex(receipt.transactionHash) },
      set: {
        receipt: e.insert(e.Receipt, {
          success: false,
          responses: [callResponse.data].filter(isTruthy),
          gasUsed: receipt.gasUsed,
          ethFeePerGas: asDecimal(receipt.effectiveGasPrice, ETH).toString(),
          block: receipt.blockNumber,
          timestamp: new Date(Number(block.timestamp) * 1000), // block.timestamp is in seconds
        }),
      },
    }));

    const transaction = await this.db.query(
      e.select(updatedTransaction, () => ({
        proposal: {
          id: true,
          account: { approvers: { user: true } },
          paymasterEthFee: true,
        },
        ethPerFeeToken: true,
        usdPerFeeToken: true,
      })),
    );
    if (!transaction)
      throw new Error(`Transaction not found for reverted transaction: ${receipt.transactionHash}`);

    const proposal = transaction.proposal;
    this.log.debug(`Proposal reverted: ${proposal.id}`);

    await this.proposals.publishProposal(
      { id: asUUID(proposal.id), account: asUAddress(receipt.from, chain) },
      ProposalEvent.executed,
    );

    const usdPerEth = new Decimal(transaction.usdPerFeeToken).div(transaction.ethPerFeeToken);
    const revenue = new Decimal(transaction.proposal.paymasterEthFee).mul(usdPerEth).toNumber();
    proposal.account.approvers.forEach(({ user }) => {
      ampli.transactionExecuted(user.id, { success: false }, { revenue });
    });
  }

  private async addMissingJobs() {
    await runOnce(
      async () => {
        const jobs = await this.queue.getJobs(RUNNING_JOB_STATUSES);

        const orphanedTransactions = await this.db.query(
          e.select(e.Transaction, (t) => ({
            filter: and(
              e.op('not', e.op('exists', t.receipt)),
              jobs.length
                ? e.op(t.hash, 'not in', e.set(...jobs.map((job) => job.data.transaction)))
                : undefined,
            ),
            hash: true,
            proposal: {
              account: { address: true },
            },
          })),
        );

        if (orphanedTransactions.length) {
          await this.queue.addBulk(
            orphanedTransactions.map((t) => ({
              name: TRANSACTIONS_QUEUE.name,
              data: {
                chain: asChain(asUAddress(t.proposal.account.address)),
                transaction: asHex(t.hash),
              },
            })),
          );
        }
      },
      {
        redis: this.redis,
        key: 'transactions-missing-jobs',
      },
    );
  }
}
