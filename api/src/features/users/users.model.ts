import { Field, ObjectType } from '@nestjs/graphql';
import { IdField } from '~/apollo/scalars/Id.scalar';
import { Contact } from '../contacts/contacts.model';
import { uuid } from 'edgedb/dist/codecs/ifaces';
import { UserApprover } from '../approvers/approvers.model';
import { GraphQLURL } from 'graphql-scalars';

@ObjectType()
export class User {
  @IdField()
  id: uuid;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => GraphQLURL, { nullable: true })
  photoUri?: string;

  @Field(() => [UserApprover])
  approvers: UserApprover[];

  @Field(() => [Contact])
  contacts: Contact[];
}
