import { Module } from '@nestjs/common';
import { ExpoModule } from '~/features/util/expo/expo.module';
import { TransactionProposalsResolver } from './transaction-proposals.resolver';
import { TransactionProposalsService } from './transaction-proposals.service';
import { ProposalsModule } from '../proposals/proposals.module';
import { PaymastersModule } from '~/features/paymasters/paymasters.module';
import { PricesModule } from '~/features/prices/prices.module';
import { TransactionsModule } from '~/features/transactions/transactions.module';
import { registerBullQueue } from '~/features/util/bull/bull.util';
import {
  ExecutionsFlow,
  ExecutionsQueue,
  ExecutionsWorker,
} from '~/features/transaction-proposals/executions.worker';
import { TRANSACTIONS_QUEUE } from '~/features/transactions/transactions.queue';
import { SIMULATIONS_QUEUE } from '~/features/simulations/simulations.worker';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ...registerBullQueue(SIMULATIONS_QUEUE, ExecutionsQueue, TRANSACTIONS_QUEUE),
    BullModule.registerFlowProducer(ExecutionsFlow),
    TransactionsModule,
    ExpoModule,
    ProposalsModule,
    PricesModule,
    PaymastersModule,
  ],
  exports: [TransactionProposalsService],
  providers: [TransactionProposalsResolver, TransactionProposalsService, ExecutionsWorker],
})
export class TransactionProposalsModule {}
