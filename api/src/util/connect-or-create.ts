import { Prisma } from '@prisma/client';
import { Address, QuorumGuid, QuorumKey } from 'lib';

export const connectAccount = (
  id: Address,
): Prisma.AccountCreateNestedOneWithoutProposalsInput => ({
  connect: { id },
});

export const connectOrCreateUser = (
  id: Address,
): Prisma.UserCreateNestedOneWithoutApprovalsInput => ({
  connectOrCreate: {
    where: { id },
    create: { id },
  },
});

export const connectQuorum = (
  ...params: [QuorumGuid] | [Address, QuorumKey]
): Prisma.QuorumCreateNestedOneWithoutProposalsInput => ({
  connect: {
    accountId_key: {
      accountId: params.length === 1 ? params[0].account : params[0],
      key: params.length === 1 ? params[0].key : params[1],
    },
  },
});
