import * as hre from 'hardhat';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import {
  Account__factory,
  asAddress,
  asPolicy,
  asTx,
  deployAccountProxy,
  executeTx,
  Factory__factory,
  randomDeploySalt,
  TestAccount__factory,
  Tx,
  TxOptions,
} from 'lib';
import { WALLETS, WALLET } from './wallet';
import { BigNumberish, Overrides } from 'ethers';
import * as zk from 'zksync-web3';
import { BytesLike, parseEther } from 'ethers/lib/utils';
import { getApprovals } from './execute';

type AccountContractName = 'Account' | 'TestAccount';

export const ACCOUNT_START_BALANCE = parseEther('0.02');

interface DeployOptions<ConstructorArgs extends unknown[] = unknown[]> {
  constructorArgs?: ConstructorArgs;
  overrides?: Overrides;
  additionalFactoryDeps?: BytesLike[];
}

const deployer = new Deployer(hre, WALLET);
export const deploy = async (
  contractName: string,
  { constructorArgs, overrides, additionalFactoryDeps }: DeployOptions = {},
) => {
  const artifact = await deployer.loadArtifact(contractName);

  const contract = await deployer.deploy(
    artifact,
    constructorArgs,
    overrides,
    additionalFactoryDeps,
  );
  await contract.deployed();

  return contract;
};

export const deployFactory = async (contractName: string) => {
  const contractArtifact = await deployer.loadArtifact(contractName);
  const contractBytecodeHash = zk.utils.hashBytecode(contractArtifact.bytecode);

  const contract = await deploy('Factory', {
    constructorArgs: [contractBytecodeHash],
    additionalFactoryDeps: [contractArtifact.bytecode],
  });

  return {
    factory: Factory__factory.connect(contract.address, WALLET),
    deployTx: contract.deployTransaction,
  };
};

export const deployAccountImpl = async ({
  contractName = 'Account',
}: {
  contractName?: AccountContractName;
} = {}) => {
  const contract = await deploy(contractName);
  const impl = asAddress(contract.address);

  return {
    impl,
    account: Account__factory.connect(impl, WALLET),
    deployTx: contract.deployTransaction,
  };
};

export type AccountImplData = Awaited<ReturnType<typeof deployAccountImpl>>;

export interface DeployProxyOptions {
  nApprovers?: number;
  contractName?: AccountContractName;
  extraBalance?: BigNumberish;
}

export const deployProxy = async ({
  nApprovers = 2,
  contractName = 'Account',
  extraBalance,
}: DeployProxyOptions = {}) => {
  const approvers = new Set(WALLETS.slice(0, nApprovers).map((signer) => signer.address));
  const policy = asPolicy({ key: 1, approvers, threshold: approvers.size });

  const { factory } = await deployFactory('ERC1967Proxy');
  const { impl } = await deployAccountImpl({ contractName });
  const { account, transaction } = await deployAccountProxy({
    factory,
    impl,
    policies: [policy],
    salt: randomDeploySalt(),
  });
  await transaction.wait();

  const txResp = await WALLET.sendTransaction({
    to: account.address,
    value: ACCOUNT_START_BALANCE.add(extraBalance || 0),
  });
  await txResp.wait();

  return {
    account,
    policy,
    execute: async (txOpts: TxOptions) => {
      const tx = asTx(txOpts);

      return await executeTx({
        account,
        policy,
        tx,
        approvals: await getApprovals(account, approvers, tx),
      });
    },
  };
};

export type DeployProxyData = Awaited<ReturnType<typeof deployProxy>>;

export const deployTestProxy = async (options: Omit<DeployProxyOptions, 'contractName'> = {}) => {
  const { account, ...rest } = await deployProxy({ ...options, contractName: 'TestAccount' });

  return { ...rest, account: TestAccount__factory.connect(account.address, WALLET) };
};

export type DeployTesterProxyData = Awaited<ReturnType<typeof deployTestProxy>>;
