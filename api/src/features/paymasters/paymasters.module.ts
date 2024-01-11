import { Module, forwardRef } from '@nestjs/common';
import { PaymastersService } from './paymasters.service';
import { PaymastersResolver } from './paymasters.resolver';
import { PricesModule } from '~/features/prices/prices.module';
import { PaymasterEvents } from '~/features/paymasters/paymaster.events';
import { TransactionsModule } from '~/features/transactions/transactions.module';
import { TokensModule } from '~/features/tokens/tokens.module';
import { ActivationsModule } from '../activations/activations.module';

@Module({
  imports: [
    PricesModule,
    forwardRef(() => TransactionsModule),
    forwardRef(() => TokensModule),
    ActivationsModule,
  ],
  exports: [PaymastersService],
  providers: [PaymastersService, PaymastersResolver, PaymasterEvents],
})
export class PaymastersModule {}
