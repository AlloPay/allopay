import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ACCOUNT_IMPLEMENTATION,
  asChain,
  asDecimal,
  asHex,
  asUAddress,
  asUUID,
  isHex,
  isTruthy,
} from 'lib';
import { TransactionData, TransactionEventData, ReceiptsWorker } from './receipts.worker';
import { InjectQueue } from '@nestjs/bullmq';
import { ReceiptsQueue } from './receipts.queue';
import e from '~/edgeql-js';
import { DatabaseService } from '../database/database.service';
import { and } from '../database/database.util';
import { NetworksService } from '../util/networks/networks.service';
import { getAbiItem } from 'viem';
import { ProposalsService } from '../proposals/proposals.service';
import { ProposalEvent } from '../proposals/proposals.input';
import { InjectRedis } from '@songkeys/nestjs-redis';
import Redis from 'ioredis';
import { RUNNING_JOB_STATUSES, TypedQueue } from '../util/bull/bull.util';
import { ETH } from 'lib/dapps';
import { runOnce } from '~/util/mutex';
import { ampli } from '~/util/ampli';

const opExecutedEvent = getAbiItem({ abi: ACCOUNT_IMPLEMENTATION.abi, name: 'OperationExecuted' });
const opsExecutedEvent = getAbiItem({
  abi: ACCOUNT_IMPLEMENTATION.abi,
  name: 'OperationsExecuted',
});

@Injectable()
export class TransactionsEvents implements OnModuleInit {
  private log = new Logger(this.constructor.name);

  constructor(
    @InjectQueue(ReceiptsQueue.name)
    private queue: TypedQueue<ReceiptsQueue>,
    private db: DatabaseService,
    @InjectRedis() private redis: Redis,
    private networks: NetworksService,
    private receipts: ReceiptsWorker,
    private proposals: ProposalsService,
  ) {
    this.receipts.onEvent(opExecutedEvent, (data) => this.executed(data));
    this.receipts.onEvent(opsExecutedEvent, (data) => this.executed(data));
    this.receipts.onTransaction((data) => this.reverted(data));
  }

  onModuleInit() {
    this.addMissingJobs();
  }

  private async executed({
    chain,
    log,
    receipt,
    block,
  }: TransactionEventData<typeof opExecutedEvent> | TransactionEventData<typeof opsExecutedEvent>) {
    const { args } = log;

    const updatedTransaction = e.update(e.Transaction, () => ({
      filter_single: { hash: receipt.transactionHash },
      set: {
        receipt: e.insert(e.Receipt, {
          success: true,
          responses: 'responses' in args ? [...args.responses] : [args.response],
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

    // const usdPerEth = new Decimal(transaction.usdPerFeeToken).div(transaction.ethPerFeeToken);
    const revenue = 0; // new Decimal(0).mul(usdPerEth).toNumber();
    proposal.account.approvers.forEach(({ user }) => {
      ampli.transactionExecuted(user.id, { success: false }, { revenue });
    });
  }

  private async reverted({ chain, receipt, block }: TransactionData) {
    if (receipt.status !== 'reverted') return;

    const network = this.networks.get(chain);
    const { gasPrice: _, ...tx } = await network.getTransaction({ hash: receipt.transactionHash });
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

    // const usdPerEth = new Decimal(transaction.usdPerFeeToken).div(transaction.ethPerFeeToken);
    const revenue = 0; // new Decimal(0).mul(usdPerEth).toNumber();
    proposal.account.approvers.forEach(({ user }) => {
      ampli.transactionExecuted(user.id, { success: false }, { revenue });
    });
  }

  private async addMissingJobs() {
    await runOnce(
      async () => {
        const jobs = (await this.queue.getJobs(RUNNING_JOB_STATUSES))
          .map((j) => j.data.transaction)
          .filter(isHex);

        const orphanedTransactions = await this.db.query(
          e.select(e.Transaction, (t) => ({
            filter: and(
              e.op('not', e.op('exists', t.receipt)),
              jobs.length ? e.op(t.hash, 'not in', e.set(...jobs)) : undefined,
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
              name: ReceiptsQueue.name,
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
