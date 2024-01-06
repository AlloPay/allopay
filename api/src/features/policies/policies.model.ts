import { createUnionType, Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AbiFunction } from 'abitype';
import { uuid } from 'edgedb/dist/codecs/ifaces';
import { GraphQLBigInt } from 'graphql-scalars';

import {
  Address,
  SatisfiabilityReason as ISatisfiabilityReason,
  SatisfiabilityResult as ISatisfiabilityResult,
  Satisfiability,
  Selector,
} from 'lib';
import { AbiFunctionField } from '~/apollo/scalars/AbiFunction.scalar';
import { AddressField } from '~/apollo/scalars/Address.scalar';
import { SelectorField } from '~/apollo/scalars/Bytes.scalar';
import { IdField } from '~/apollo/scalars/Id.scalar';
import { PolicyKeyField } from '~/apollo/scalars/PolicyKey.scalar';
import { Err, ErrorType, Node, NodeType } from '~/decorators/interface.decorator';
import * as eql from '~/edgeql-interfaces';
import e from '~/edgeql-js';
import { makeUnionTypeResolver } from '~/features/database/database.util';
import { Account } from '../accounts/accounts.model';
import { Approver } from '../approvers/approvers.model';
import { TransactionProposal } from '../transaction-proposals/transaction-proposals.model';

@ObjectType()
export class Policy {
  @IdField()
  id: uuid;

  @Field(() => Account)
  account: Account;

  @PolicyKeyField()
  key: number; // PolicyKey;

  @Field(() => String)
  name: string;

  @Field(() => PolicyState, { nullable: true })
  state?: PolicyState | null;

  @Field(() => PolicyState, { nullable: true })
  draft?: PolicyState | null;

  @Field(() => [PolicyState])
  stateHistory: PolicyState[];

  @Field(() => Boolean)
  isActive: boolean;
}

@NodeType()
export class ActionFunction extends Node implements eql.ActionFunction {
  @AddressField({ nullable: true, description: 'Default: apply to all contracts' })
  contract: Address | null;

  @SelectorField({ nullable: true, description: 'Default: apply to all selectors' })
  selector: Selector | null;

  @AbiFunctionField({ nullable: true })
  abi: AbiFunction | null;
}

@NodeType()
export class Action extends Node implements eql.Action {
  @Field(() => String)
  label: string;

  @Field(() => [ActionFunction])
  functions: [ActionFunction, ...ActionFunction[]];

  @Field(() => Boolean)
  allow: boolean;

  @Field(() => String, { nullable: true })
  description: string | null;
}

@ObjectType()
export class TransferLimit {
  @IdField()
  id: uuid;

  @AddressField()
  token: Address;

  @Field(() => GraphQLBigInt)
  amount: bigint;

  @Field(() => Number, { description: 'seconds' })
  duration: number;
}

@ObjectType()
export class TransfersConfig implements eql.TransfersConfig {
  @IdField()
  id: uuid;

  @Field(() => [TransferLimit])
  limits: TransferLimit[];

  @Field(() => Boolean)
  defaultAllow: boolean;

  @Field(() => Number)
  budget: number;
}

@ObjectType()
export class PolicyState {
  @IdField()
  id: uuid;

  @Field(() => TransactionProposal, { nullable: true })
  proposal?: TransactionProposal | null;

  @Field(() => Boolean)
  isAccountInitState: boolean;

  @Field(() => [Approver])
  approvers: Approver[];

  @Field(() => Number)
  threshold: number;

  @Field(() => [Action])
  actions: Action[];

  @Field(() => TransfersConfig)
  transfers: TransfersConfig;

  @Field(() => Boolean)
  isRemoved: boolean;

  @Field(() => GraphQLBigInt, { nullable: true })
  activationBlock?: bigint | null;

  @Field(() => Date)
  createdAt: Date;
}

registerEnumType(Satisfiability, { name: 'Satisfiability' });

@ObjectType()
export class SatisfiabilityResult implements ISatisfiabilityResult {
  @Field(() => Satisfiability)
  result: Satisfiability;

  @Field(() => [SatisfiabilityReason])
  reasons: SatisfiabilityReason[];
}

@ObjectType()
export class SatisfiabilityReason implements ISatisfiabilityReason {
  @Field(() => String)
  reason: string;

  @Field(() => Number, { nullable: true })
  operation?: number;
}

@ErrorType()
export class NameTaken extends Err {}

export const CreatePolicyResponse = createUnionType({
  name: 'CreatePolicyResponse',
  types: () => [Policy, NameTaken],
  resolveType: makeUnionTypeResolver([[e.Policy, Policy]]),
});

export const UpdatePolicyResponse = createUnionType({
  name: 'UpdatePolicyResponse',
  types: () => [Policy, NameTaken],
  resolveType: makeUnionTypeResolver([[e.Policy, Policy]]),
});
