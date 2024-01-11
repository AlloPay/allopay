import { Processor } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { TransactionsQueue } from './transactions.queue';
import { NetworksService } from '../util/networks/networks.service';
import { Chain, ChainConfig } from 'chains';
import {
  FormattedBlock,
  FormattedTransactionReceipt,
  Hex,
  decodeEventLog,
  encodeEventTopics,
} from 'viem';
import { AbiEvent } from 'abitype';
import { Log } from '~/features/events/events.worker';
import { QueueReturnType, TypedJob, Worker } from '~/features/util/bull/bull.util';
import { asHex, isPresent } from 'lib';
import { ActivationsQueue } from '../activations/activations.queue';

export const REQUIRED_CONFIRMATIONS = 1;

export interface TransactionData {
  chain: Chain;
  receipt: FormattedTransactionReceipt<ChainConfig>;
  block: FormattedBlock<ChainConfig, false>;
}

export type TransactionListener = (data: TransactionData) => Promise<void>;

export interface TransactionEventData<TAbiEvent extends AbiEvent> extends TransactionData {
  log: Log<TAbiEvent>;
}

export type TransactionEventListener<TAbiEvent extends AbiEvent> = (
  data: TransactionEventData<TAbiEvent>,
) => Promise<void>;

@Injectable()
@Processor(TransactionsQueue.name)
export class TransactionsWorker extends Worker<TransactionsQueue> {
  private listeners: TransactionListener[] = [];
  private events: AbiEvent[] = [];
  private eventListeners = new Map<Hex, TransactionEventListener<AbiEvent>[]>();

  constructor(private networks: NetworksService) {
    super();
  }

  onTransaction(listener: TransactionListener) {
    this.listeners.push(listener);
  }

  onEvent<TAbiEvent extends AbiEvent>(
    event: TAbiEvent,
    listener: TransactionEventListener<TAbiEvent>,
  ) {
    const topic = encodeEventTopics({ abi: [event as AbiEvent] })[0];
    this.eventListeners.set(topic, [
      ...(this.eventListeners.get(topic) ?? []),
      listener as unknown as TransactionEventListener<AbiEvent>,
    ]);
    this.events.push(event);
  }

  async process(job: TypedJob<TransactionsQueue>) {
    const { chain } = job.data;
    const transaction =
      job.data.transaction === 'child'
        ? asHex(
            Object.values(await job.getChildrenValues())[0] as QueueReturnType<ActivationsQueue>,
          )
        : job.data.transaction;
    if (!transaction) return;

    const network = this.networks.get(chain);
    const receipt = await network.waitForTransactionReceipt({
      hash: transaction,
      confirmations: REQUIRED_CONFIRMATIONS,
      timeout: 60_000,
      pollingInterval: 1_000,
    });
    const block = await network.getBlock({ blockNumber: receipt.blockNumber });

    await Promise.all([
      ...this.listeners.map((listener) => listener({ chain, receipt, block })),
      ...receipt.logs
        .filter((log) => log.topics.length && this.eventListeners.has(log.topics[0]!))
        .map((log) => {
          try {
            const event = decodeEventLog({
              abi: this.events,
              topics: log.topics,
              data: log.data,
              strict: true,
            });
            return { ...log, ...event } as Log<AbiEvent>;
          } catch {
            return null;
          }
        })
        .filter(isPresent)
        .flatMap(
          (log) =>
            this.eventListeners
              .get(log.topics[0]!)
              ?.map((listener) => listener({ chain, log, receipt, block })),
        ),
    ]);
  }
}
