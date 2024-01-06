import { AbiParameterToPrimitiveType } from 'abitype';
import {
  getAbiItem,
  hexToSignature,
  recoverAddress,
  signatureToCompactSignature,
  size,
} from 'viem';

import { Network } from 'chains';
import { ERC1271_ABI } from './abi/erc1271';
import { Address, asAddress, compareAddress } from './address';
import { Hex } from './bytes';
import { TEST_VERIFIER_ABI } from './contract';
import { tryOrIgnoreAsync } from './util';

export type SignatureType = 'secp256k1' | 'erc1271';

export interface Approval {
  type: SignatureType;
  approver: Address;
  signature: Hex;
}

export interface ApprovalsParams {
  approvals: Approval[];
  approvers: Set<Address>;
}

export const APPROVALS_ABI = getAbiItem({ abi: TEST_VERIFIER_ABI, name: 'verifyApprovals' })
  .inputs[0];
export type ApprovalsStruct = AbiParameterToPrimitiveType<typeof APPROVALS_ABI>;

export function encodeApprovalsStruct({ approvals, approvers }: ApprovalsParams): ApprovalsStruct {
  approvals = approvals.sort((a, b) => compareAddress(a.approver, b.approver));
  const sortedApprovers = [...approvers].sort(compareAddress);

  // Approvers are encoded as a bitfield, where each bit represents whether the approver has signed
  let approversSigned = 0n;
  for (let i = 0; i < sortedApprovers.length; i++) {
    const approved = approvals.find((a) => a.approver === sortedApprovers[i]!);
    if (approved) approversSigned |= 1n << BigInt(i);
  }

  return {
    approversSigned,
    secp256k1: approvals
      .filter((a) => a.type === 'secp256k1')
      .map((a) => signatureToCompactSignature(hexToSignature(a.signature))),
    erc1271: approvals.filter((a) => a.type === 'erc1271').map((a) => a.signature),
  };
}

const ERC1271_SUCCESS = '0x1626ba7e';

export interface AsApprovalOptions {
  network: Network;
  hash: Hex;
  approver: Address;
  signature: Hex;
}

export const asApproval = async ({
  network,
  hash,
  approver,
  signature,
}: AsApprovalOptions): Promise<Approval | null> => {
  const as = (type: SignatureType): Approval => ({ type, approver, signature });

  const sigSize = size(signature);
  if (
    (sigSize === 64 || sigSize === 65) &&
    (await tryOrIgnoreAsync(
      async () => asAddress(await recoverAddress({ hash: hash, signature })) === approver,
    ))
  )
    return as('secp256k1');

  // Note. even EOAs have contract code on zkSync
  const isValidErc1271 = await tryOrIgnoreAsync(async () => {
    const r = await network.readContract({
      address: approver,
      abi: ERC1271_ABI,
      functionName: 'isValidSignature',
      args: [hash, signature],
    });

    return r === ERC1271_SUCCESS;
  });

  return isValidErc1271 ? as('erc1271') : null;
};
