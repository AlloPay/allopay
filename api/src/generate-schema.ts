import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { writeFileSync } from 'fs';
import { printSchema } from 'graphql';
import { join } from 'path';
import type {} from './request/request';
import { AccountsResolver } from './features/accounts/accounts.resolver';
import { ApproversResolver } from './features/approvers/approvers.resolver';
import { CommentsResolver } from './features/comments/comments.resolver';
import { ContactsResolver } from './features/contacts/contacts.resolver';
import { ContractMethodsResolver } from './features/contract-methods/contract-methods.resolver';
import { DevicesResolver } from './features/devices/devices.resolver';
import { FaucetResolver } from './features/faucet/faucet.resolver';
import { ProposalsResolver } from './features/proposals/proposals.resolver';
import { ReactionsResolver } from './features/reactions/reactions.resolver';
import { UsersResolver } from './features/users/users.resolver';

const resolvers = [
  AccountsResolver,
  ApproversResolver,
  CommentsResolver,
  ContactsResolver,
  ContractMethodsResolver,
  DevicesResolver,
  FaucetResolver,
  ProposalsResolver,
  ReactionsResolver,
  UsersResolver,
];

const main = async () => {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule);
  await app.init();

  const gqlSchemaFactory = app.get(GraphQLSchemaFactory);
  const schema = await gqlSchemaFactory.create(resolvers);

  writeFileSync(join(process.cwd(), '/schema.gql'), printSchema(schema));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
