import {
  User,
  createUpsertUserTx,
  getMerkleTree,
  AccountEvent,
  sortAddresses,
  compareUserConfig,
} from 'lib';
import { deploy, expect, execute, deployTestAccount, allSigners } from './util';

const modifiedUser = (user: User): User => ({
  ...user,
  configs: [
    ...user.configs,
    {
      approvers: sortAddresses([allSigners[4].address, allSigners[5].address]),
      spendingAllowlisted: false,
      limits: {},
    },
  ].sort(compareUserConfig),
});

describe('UpsertUser', () => {
  it('should successfully execute', async () => {
    const { account, user, config } = await deploy();

    await execute(account, user, config, createUpsertUserTx(account, modifiedUser(user)));
  });

  it('should emit event', async () => {
    const { account, user, config } = await deploy();

    const txResp = await execute(
      account,
      user,
      config,
      createUpsertUserTx(account, modifiedUser(user)),
    );

    await expect(txResp).to.emit(account, AccountEvent.UserUpserted);
  });

  it('should generate the correct wallet merkle root', async () => {
    const { account, user } = await deployTestAccount();

    const expectedRoot = getMerkleTree(user).getHexRoot();
    const actual = await account.getUserMerkleRoot(user.addr);

    expect(actual).to.eq(expectedRoot);
  });

  it('should revert if called from an address other than the account', async () => {
    const { account, user } = await deploy();

    const tx = await account.upsertUser(modifiedUser(user), {
      gasLimit: 500_000,
    });

    let reverted = false;
    try {
      await tx.wait(); // AccountError.OnlyCallableByAccount
    } catch (_) {
      reverted = true;
    }
    expect(reverted).to.be.true;
  });
});
