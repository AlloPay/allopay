import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '~/core/database';
import { AccountsCacheService } from '../auth/accounts.cache.service';
import { getAbiItem } from 'viem';
import { ACCOUNT_ABI, UUID, asChain, asUAddress, asUUID } from 'lib';
import e from '~/edgeql-js';
import { InjectFlowProducer, InjectQueue } from '@nestjs/bullmq';
import { FLOW_PRODUCER, QueueData, RUNNING_JOB_STATUSES, TypedQueue } from '~/core/bull/bull.util';
import { runOnce } from '~/util/mutex';
import { InjectRedis } from '@songkeys/nestjs-redis';
import Redis from 'ioredis';
import { and } from '~/core/database';
import { FlowJob, FlowProducer } from 'bullmq';
import { SimulationsQueue } from '../simulations/simulations.worker';
import { ConfirmationQueue } from './confirmations.queue';
import { Chain } from 'chains';
import { ProposalsService } from '../proposals/proposals.service';
import { ProposalEvent } from '../proposals/proposals.input';
import { selectSysTx } from './system-tx.util';
import { selectTransaction } from '../transactions/transactions.util';
import { ExecutionsQueue } from '~/feat/transactions/executions.worker';
import { DEFAULT_FLOW } from '~/core/bull/bull.module';
import { ConfirmedEvent, EventsService } from '../events/events.service';

const scheduledEvent = getAbiItem({ abi: ACCOUNT_ABI, name: 'Scheduled' });
const scheduleCancelledEvent = getAbiItem({ abi: ACCOUNT_ABI, name: 'ScheduleCancelled' });

@Injectable()
export class SchedulerEvents implements OnModuleInit {
  private log = new Logger(this.constructor.name);

  constructor(
    private db: DatabaseService,
    private events: EventsService,
    private accountsCache: AccountsCacheService,
    @InjectQueue(ExecutionsQueue.name) private queue: TypedQueue<ExecutionsQueue>,
    @InjectRedis() private redis: Redis,
    @InjectFlowProducer(FLOW_PRODUCER)
    private flows: FlowProducer,
    private proposals: ProposalsService,
  ) {
    this.events.onConfirmed(scheduledEvent, (event) => this.scheduled(event));
    this.events.onConfirmed(scheduleCancelledEvent, (event) => this.scheduleCancelled(event));
  }

  onModuleInit() {
    this.addMissingJobs();
  }

  private async scheduled(event: ConfirmedEvent<typeof scheduledEvent>) {
    if (!event.receipt) return;

    const account = asUAddress(event.log.address, event.chain);
    if (!(await this.accountsCache.isAccount(account))) return;

    const scheduledFor = new Date(Number(event.log.args.timestamp) * 1000);
    const proposalId = await this.db.query(
      e.insert(e.Scheduled, {
        transaction: selectTransaction(event.log.args.proposal),
        systx: selectSysTx(event.log.transactionHash),
        scheduledFor,
        gasUsed: event.receipt.gasUsed,
        response: '0x',
      }).transaction.id,
    );

    if (proposalId) {
      this.flows.add(this.getJob(asUUID(proposalId), event.chain, scheduledFor));
      this.proposals.event({ id: asUUID(proposalId), account }, ProposalEvent.scheduled);
      this.log.debug(`Scheduled ${proposalId}`);
    }
  }

  private async scheduleCancelled(event: ConfirmedEvent<typeof scheduleCancelledEvent>) {
    const account = asUAddress(event.log.address, event.chain);
    if (!(await this.accountsCache.isAccount(account))) return;

    const proposalId = await this.db.query(
      e.assert_single(
        e.update(e.Scheduled, (t) => ({
          filter: and(
            e.op(t.transaction, '=', selectTransaction(event.log.args.proposal)),
            e.op(t.transaction.account.address, '=', account),
          ),
          set: { cancelled: true },
        })),
      ).transaction.id,
    );

    if (proposalId) {
      this.queue.remove(event.log.args.proposal);
      this.proposals.event({ id: asUUID(proposalId), account }, ProposalEvent.cancelled);
      this.log.debug(`Cancelled scheduled ${proposalId}`);
    }
  }

  private getJob(txProposal: UUID, chain: Chain, scheduledFor: Date): FlowJob {
    return {
      queueName: ConfirmationQueue.name,
      name: 'Scheduled transaction',
      data: { chain, transaction: { child: 0 } } satisfies QueueData<ConfirmationQueue>,
      children: [
        {
          queueName: ExecutionsQueue.name,
          name: 'Scheduled transaction',
          data: { transaction: txProposal, type: 'scheduled' } satisfies QueueData<ExecutionsQueue>,
          opts: { jobId: txProposal },
          children: [
            {
              queueName: SimulationsQueue.name,
              name: 'Simulate scheduled transaction',
              data: { transaction: txProposal } satisfies QueueData<SimulationsQueue>,
              opts: { delay: scheduledFor.getTime() - Date.now() },
            },
          ],
        },
      ],
    };
  }

  private async addMissingJobs() {
    await runOnce(
      async () => {
        const jobs = await this.queue.getJobs(RUNNING_JOB_STATUSES);

        const orphanedProposals = await this.db.query(
          e.select(e.select(e.Transaction).result.is(e.Scheduled), (s) => ({
            filter: and(
              e.op('not', s.cancelled),
              jobs.length
                ? e.op(
                    s.transaction.id,
                    'not in',
                    e.cast(e.uuid, e.set(...jobs.map((j) => j.data.transaction))),
                  )
                : undefined,
            ),
            transaction: {
              id: true,
              account: { address: true },
            },
            scheduledFor: true,
          })),
        );

        if (orphanedProposals.length)
          await Promise.all(
            orphanedProposals.map((t) =>
              this.flows.add(
                this.getJob(
                  asUUID(t.transaction.id),
                  asChain(asUAddress(t.transaction.account.address)),
                  new Date(t.scheduledFor!),
                ),
                DEFAULT_FLOW,
              ),
            ),
          );
      },
      {
        redis: this.redis,
        key: 'scheduler-missing-jobs',
      },
    );
  }
}
