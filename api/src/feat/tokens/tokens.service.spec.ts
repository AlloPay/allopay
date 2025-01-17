import { Test, TestingModule } from '@nestjs/testing';
import { TokensService } from './tokens.service';
import { DatabaseService } from '~/core/database';
import { DeepMocked, createMock } from '@golevelup/ts-jest';
import { UserContext, asUser } from '~/core/context';
import { randomUser, DeepPartial, randomUAddress } from '~/util/test';
import e from '~/edgeql-js';
import { UpsertTokenInput } from './tokens.input';
import { Network, NetworksService } from '~/core/networks/networks.service';

describe('TokensService', () => {
  let service: TokensService;
  let db: DatabaseService;
  let networks: DeepMocked<NetworksService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokensService, DatabaseService],
    })
      .useMocker(createMock)
      .compile();

    service = module.get(TokensService);
    db = module.get(DatabaseService);
    networks = module.get(NetworksService);

    networks.get.mockReturnValue({
      multicall: async () => [{ result: 'Token' }, { result: 'TKN' }],
      readContract: async () => 18,
    } satisfies DeepPartial<Network> as unknown as Network);
  });

  let user1: UserContext;
  beforeEach(async () => {
    user1 = randomUser();
    await db.query(e.insert(e.Approver, { address: user1.approver }));
  });

  const upsert = (input?: Partial<UpsertTokenInput>) => {
    return service.upsert({
      address: randomUAddress(),
      name: 'Test token',
      symbol: 'TEST',
      units: [],
      ...input,
    });
  };

  describe('upsert', () => {
    it('insert a new token', async () =>
      asUser(user1, async () => {
        const { id } = await upsert();

        expect(await db.query(e.select(e.Token, () => ({ filter_single: { id } })).id)).toEqual(id);
      }));

    it('update existing token', async () =>
      asUser(user1, async () => {
        const address = randomUAddress();
        const { id } = await upsert({ address, name: 'first' });
        await upsert({ address, name: 'second' });

        expect(
          await db.query(e.select(e.Token, () => ({ filter_single: { id }, name: true })).name),
        ).toEqual('second');
      }));
  });

  describe('select', () => {
    it('include user tokens', async () =>
      asUser(user1, async () => {
        const { id } = await upsert();

        expect(
          (await service.select({}, () => ({ id: true }))).find((t) => t.id === id),
        ).toBeTruthy();
      }));

    it('include global tokens', async () => {
      const { id } = await db.query(
        e.insert(e.Token, {
          user: e.cast(e.User, e.set()),
          address: randomUAddress(),
          name: 'Test token',
          symbol: 'TEST',
          decimals: 8,
          units: [],
        }),
      );

      await asUser(user1, async () => {
        expect(
          (await service.select({}, () => ({ id: true }))).find((t) => t.id === id),
        ).toBeTruthy();
      });
    });

    it('prefer user token over global token', async () => {
      const address = randomUAddress();
      await db.query(
        e.insert(e.Token, {
          user: e.cast(e.User, e.set()),
          address,
          name: 'Test token',
          symbol: 'TEST',
          decimals: 8,
          units: [],
        }),
      );

      await asUser(user1, async () => {
        await upsert({ address, name: 'second' });

        service;
        expect(
          (await service.select({}, () => ({ address: true, name: true })))
            .filter((t) => t.address === address)
            .map((t) => t.name),
        ).toEqual(['second']);
      });
    });
  });

  describe('remove', () => {
    it('removes token if existent', async () =>
      asUser(user1, async () => {
        const address = randomUAddress();
        const { id } = await upsert({ address });
        await service.remove(address);

        expect(await db.query(e.select(e.Token, () => ({ filter_single: { id } })))).toBeNull();
      }));

    it('not remove global token', async () => {
      const address = randomUAddress();
      const { id } = await db.query(
        e.insert(e.Token, {
          user: e.cast(e.User, e.set()),
          address,
          name: 'Test token',
          symbol: 'TEST',
          decimals: 8,
          units: [],
        }),
      );

      asUser(user1, async () => {
        expect(await service.remove(address)).toBeNull();

        expect((await db.query(e.select(e.Token, () => ({ filter_single: { id } }))))?.id).toEqual(
          id,
        );
      });
    });
  });
});
