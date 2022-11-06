import { FindManyProposalArgs } from '@gen/proposal/find-many-proposal.args';
import {
  ArgsType,
  Field,
  InputType,
  ObjectType,
  OmitType,
  registerEnumType,
} from '@nestjs/graphql';
import { BigNumber, BytesLike } from 'ethers';
import { Address, TxSalt } from 'lib';
import { AddressField } from '~/apollo/scalars/Address.scalar';
import { AddressSetField, NonEmptyAddressSetField } from '~/apollo/scalars/AddressSet.scalar';
import { BytesField } from '~/apollo/scalars/Bytes.scalar';
import { Bytes32Field } from '~/apollo/scalars/Bytes32.scalar';
import { Bytes8Field } from '~/apollo/scalars/Bytes8.scalar';
import { Uint256BnField } from '~/apollo/scalars/Uint256Bn.scalar';

@ArgsType()
export class UniqueProposalArgs {
  @Bytes32Field()
  hash: string;
}

export enum ProposalStatus {
  AwaitingUser = 'awaiting-user',
  AwaitingOther = 'awaiting-other',
  Executed = 'executed',
}
registerEnumType(ProposalStatus, { name: 'ProposalStatus' });

@ArgsType()
export class ProposalsArgs extends OmitType(FindManyProposalArgs, ['where' as const]) {
  @AddressSetField({ nullable: true })
  accounts?: Set<Address>;

  status?: ProposalStatus;
}

@InputType()
export class ProposalInput {
  @AddressField()
  to: Address;

  @Uint256BnField()
  value: BigNumber;

  @BytesField()
  data: BytesLike;

  @Bytes8Field()
  salt: TxSalt;

  @Uint256BnField({ nullable: true })
  gasLimit?: BigNumber;
}

@ArgsType()
export class ProposeArgs {
  @AddressField()
  account: Address;

  configId?: number;

  proposal: ProposalInput;

  @BytesField({ nullable: true })
  signature?: string;

  @Field(() => Boolean, { defaultValue: true })
  executeWhenApproved: boolean;
}

@ArgsType()
export class ApproveArgs extends UniqueProposalArgs {
  @BytesField()
  signature: string;

  @Field(() => Boolean, { defaultValue: true })
  executeWhenApproved: boolean;
}

@ObjectType()
export class ApprovalResponse {
  @BytesField({ nullable: true })
  transactionHash?: BytesLike;
}

@ArgsType()
export class ApprovalRequest extends UniqueProposalArgs {
  @NonEmptyAddressSetField()
  approvers: Set<Address>;
}
