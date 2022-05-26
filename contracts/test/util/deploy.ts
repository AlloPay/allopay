import * as hre from 'hardhat';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Address } from 'zksync-web3/build/types';
import {
  deploySafe,
  getFactory,
  getSafe,
  hashGroup,
  SafeConstructorArgs,
  SafeGroup,
  TestSafe__factory,
  address,
  toGroupStruct,
} from 'lib';
import { allSigners, wallet } from './wallet';
import { BytesLike } from 'ethers';

export const toSafeGroupTest = (...approvers: [string, number][]): SafeGroup =>
  toGroupStruct({
    approvers: approvers.map(([addr, weight]) => ({
      addr: address(addr),
      weight,
    })),
  });

export const deployer = new Deployer(hre, wallet);

export const deployFactory = async (feeToken?: Address) => {
  const artifact = await deployer.loadArtifact('Factory');
  const contract = await deployer.deploy(artifact, [], feeToken);
  await contract.deployed();

  return {
    factory: getFactory(address(contract.address), wallet),
    deployTx: contract.deployTransaction,
  };
};

export const deploySafeDirect = async (
  args: SafeConstructorArgs,
  feeToken?: Address,
) => {
  const artifact = await deployer.loadArtifact('Safe');
  const contract = await deployer.deploy(artifact, args, feeToken);
  await contract.deployed();

  return {
    safe: getSafe(address(contract.address), wallet),
    deployTx: contract.deployTransaction,
  };
};

export const deploy = async (weights: number[], _salt?: BytesLike) => {
  if (!weights.length) throw Error('No weights provided');

  // const allSigners = await ethers.getSigners();
  const approvers = allSigners.slice(0, weights.length);
  const others = allSigners.slice(weights.length);

  const group = toSafeGroupTest(
    ...approvers.map((approver, i): [string, number] => [
      approver.address,
      weights[i],
    ]),
  );

  const { factory } = await deployFactory();
  const deployData = await deploySafe({
    signer: allSigners[0],
    args: [group.approvers],
    factory,
    // salt,
  });

  return {
    ...deployData,
    deployer: wallet,
    factory,
    approvers,
    others,
    group,
    groupHash: hashGroup(group),
  };
};

export const deployTestSafe = async (feeToken?: Address) => {
  const group = toSafeGroupTest([wallet.address, 100]);

  const artifact = await deployer.loadArtifact('TestSafe');
  const contract = await deployer.deploy(artifact, [group.approvers], feeToken);
  await contract.deployed();

  return {
    safe: new TestSafe__factory().attach(contract.address).connect(wallet),
    deployTx: contract.deployTransaction,
    group,
  };
};
