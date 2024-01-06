import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { BalancesModule } from '~/features/util/balances/balances.module';
import { ApolloModule } from './apollo/apollo.module';
import { AccountsModule } from './features/accounts/accounts.module';
import { ApproversModule } from './features/approvers/approvers.module';
import { AuthGuard } from './features/auth/auth.guard';
import { AuthModule } from './features/auth/auth.module';
import { ContactsModule } from './features/contacts/contacts.module';
import { ContractFunctionsModule } from './features/contract-functions/contract-functions.module';
import { ContractsModule } from './features/contracts/contracts.module';
import { DatabaseModule } from './features/database/database.module';
import { EventsModule } from './features/events/events.module';
import { ExplorerModule } from './features/explorer/explorer.module';
import { FaucetModule } from './features/faucet/faucet.module';
import { HealthModule } from './features/health/health.module';
import { MessageProposalsModule } from './features/message-proposals/message-proposals.module';
import { OperationsModule } from './features/operations/operations.module';
import { PaymastersModule } from './features/paymasters/paymasters.module';
import { PoliciesModule } from './features/policies/policies.module';
import { PricesModule } from './features/prices/prices.module';
import { ProposalsModule } from './features/proposals/proposals.module';
import { ReceiptsModule } from './features/receipts/receipts.module';
import { SimulationsModule } from './features/simulations/simulations.module';
import { TokensModule } from './features/tokens/tokens.module';
import { TransactionProposalsModule } from './features/transaction-proposals/transaction-proposals.module';
import { TransactionsModule } from './features/transactions/transactions.module';
import { TransfersModule } from './features/transfers/transfers.module';
import { UsersModule } from './features/users/users.module';
import { BullModule } from './features/util/bull/bull.module';
import { ExpoModule } from './features/util/expo/expo.module';
import { NetworksModule } from './features/util/networks/networks.module';
import { PubsubModule } from './features/util/pubsub/pubsub.module';
import { RedisModule } from './features/util/redis/redis.module';
import { SentryInterceptor } from './features/util/sentry/sentry.interceptor';
import { SentryModule } from './features/util/sentry/sentry.module';

@Module({
  imports: [
    // Util
    SentryModule.forRoot(),
    DatabaseModule,
    RedisModule,
    BullModule,
    ApolloModule,
    PubsubModule,
    NetworksModule,
    BalancesModule,
    // Features
    AccountsModule,
    ApproversModule,
    AuthModule,
    ContactsModule,
    ContractFunctionsModule,
    ContractsModule,
    EventsModule,
    ExplorerModule,
    FaucetModule,
    HealthModule,
    MessageProposalsModule,
    OperationsModule,
    PaymastersModule,
    PoliciesModule,
    PricesModule,
    ProposalsModule,
    ReceiptsModule,
    SimulationsModule,
    TokensModule,
    TransactionProposalsModule,
    TransactionsModule,
    TransfersModule,
    UsersModule,
    ExpoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
})
export class AppModule {}
