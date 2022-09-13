import {
  Args,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { PrismaService } from 'nestjs-prisma';
import { GraphQLResolveInfo } from 'graphql';
import { getSelect } from '~/util/select';
import { DeviceAddr } from '~/decorators/device.decorator';
import { Address, Id, toId } from 'lib';
import {
  ContactsArgs,
  DeleteContactArgs,
  ContactObject,
  UpsertContactArgs,
} from './contacts.args';
import { connectOrCreateDevice } from '~/util/connect-or-create';
import { AccountsService } from '../accounts/accounts.service';

@Resolver(() => ContactObject)
export class ContactsResolver {
  constructor(
    private prisma: PrismaService,
    private accountsService: AccountsService,
  ) {}

  @ResolveField(() => String)
  id(@Parent() contact: ContactObject, @DeviceAddr() device: Address): Id {
    return toId(`${device}-${contact.addr}`);
  }

  @Query(() => ContactObject, { nullable: true })
  @Query(() => String, { nullable: true })
  async contacts(
    @Args() args: ContactsArgs,
    @DeviceAddr() device: Address,
    @Info() info: GraphQLResolveInfo,
  ): Promise<ContactObject[]> {
    const contacts = await this.prisma.contact.findMany({
      ...args,
      where: { deviceId: device },
      ...getSelect(info),
    });

    const accounts = await this.accountsService.accounts(device, {
      select: { id: true, name: true },
    });

    return [
      ...contacts,
      ...accounts.map((a) => ({ addr: a.id, name: a.name })),
    ];
  }

  @Mutation(() => ContactObject)
  async upsertContact(
    @Args() { prevAddr, newAddr, name }: UpsertContactArgs,
    @DeviceAddr() device: Address,
    @Info() info: GraphQLResolveInfo,
  ): Promise<ContactObject> {
    return this.prisma.contact.upsert({
      where: {
        deviceId_addr: {
          deviceId: device,
          addr: prevAddr ?? newAddr,
        },
      },
      create: {
        user: connectOrCreateDevice(device),
        addr: newAddr,
        name,
      },
      update: {
        addr: { set: newAddr },
        name: { set: name },
      },
      ...getSelect(info),
    });
  }

  @Mutation(() => Boolean)
  async deleteContact(
    @Args() { addr }: DeleteContactArgs,
    @DeviceAddr() device: Address,
    @Info() info: GraphQLResolveInfo,
  ): Promise<boolean> {
    await this.prisma.contact.delete({
      where: {
        deviceId_addr: {
          deviceId: device,
          addr,
        },
      },
      ...getSelect(info),
    });

    return true;
  }
}
