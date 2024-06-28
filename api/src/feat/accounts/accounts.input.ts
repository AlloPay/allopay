import { Field, InputType } from '@nestjs/graphql';
import { UAddress } from 'lib';
import { PolicyInput } from '../policies/policies.input';
import { Chain } from 'chains';
import {
  UAddressField,
  ChainField,
  UAddressScalar,
  UrlField,
  minLengthMiddleware,
} from '~/common/scalars';
import { AccountEvent } from './accounts.model';

@InputType()
export class AccountInput {
  @UAddressField({ nullable: true, description: 'Defaults to random user account' })
  account?: UAddress;
}

@InputType()
export class AccountsInput {
  @ChainField({ nullable: true })
  chain?: Chain;
}

@InputType()
export class NameAvailableInput {
  @Field(() => String)
  name: string;
}

@InputType()
export class AccountUpdatedInput {
  @Field(() => [UAddressScalar], {
    nullable: true,
    description: 'Defaults to user accounts',
  })
  accounts?: UAddress[];

  @Field(() => AccountEvent, { nullable: true, description: 'Defaults to all events' })
  events?: AccountEvent[];
}

@InputType()
export class CreateAccountInput {
  @ChainField({ defaultValue: 'zksync-sepolia' })
  chain: Chain;

  @Field(() => String)
  name: string;

  @Field(() => [PolicyInput], { middleware: [minLengthMiddleware(1)] })
  policies: PolicyInput[];
}

@InputType()
export class UpdateAccountInput {
  @UAddressField()
  account: UAddress;

  @Field(() => String)
  name: string;

  @UrlField({ nullable: true })
  photo?: string;
}
