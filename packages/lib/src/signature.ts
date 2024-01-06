import { parseAbiParameter } from 'abitype';
import { encodeAbiParameters } from 'viem';

import { Approval, APPROVALS_ABI, encodeApprovalsStruct } from './approvals';
import { encodePolicyStruct, Policy, POLICY_STRUCT_ABI } from './policy';
import { Tx } from './tx';

const TRANSACTION_SIGNATURE_ABI = [
  parseAbiParameter('uint32 proposalNonce'),
  POLICY_STRUCT_ABI,
  APPROVALS_ABI,
] as const;

export interface EncodeTransactionSignature {
  tx: Tx;
  policy: Policy;
  approvals: Approval[];
}

export function encodeTransactionSignature({ tx, policy, approvals }: EncodeTransactionSignature) {
  return encodeAbiParameters(TRANSACTION_SIGNATURE_ABI, [
    Number(tx.nonce),
    encodePolicyStruct(policy),
    encodeApprovalsStruct({ approvals, approvers: policy.approvers }),
  ]);
}

export interface EncodeMessageSignature {
  policy: Policy;
  approvals: Approval[];
}

export function encodeMessageSignature({ policy, approvals }: EncodeMessageSignature) {
  return encodeAbiParameters(TRANSACTION_SIGNATURE_ABI, [
    0,
    encodePolicyStruct(policy),
    encodeApprovalsStruct({ approvals, approvers: policy.approvers }),
  ]);
}
