import { Address } from './address';
import { ResultAsync } from 'neverthrow';
import { Network } from 'chains';
import type { EstimateGasErrorType } from 'viem';
import { Operation, encodeOperations } from './operation';

/*//////////////////////////////////////////////////////////////
                            OPERATIONS
//////////////////////////////////////////////////////////////*/

export const FALLBACK_OPERATIONS_GAS = 3_000_000n;

export interface EstimateOperationGasParams {
  network: Network;
  account: Address;
  operations: Operation[];
}

export function estimateTransactionOperationsGas({
  network,
  account,
  operations,
}: EstimateOperationGasParams) {
  // customSignature is always a 65 byte signature - https://github.com/zkSync-Community-Hub/zkync-developers/discussions/81
  return ResultAsync.fromPromise(
    (async () =>
      network.estimateGas({
        type: 'eip712',
        account,
        ...encodeOperations(operations),
      }))(),
    (e) => e as EstimateGasErrorType,
  );
}

/*//////////////////////////////////////////////////////////////
                          VERIFICATION
//////////////////////////////////////////////////////////////*/

const ESTIMATED_VERIFICATION_BASE_GAS = 500_000n; // TODO: estimate dynamically
const ESTIMATED_PER_APPROVER_GAS = 20_000n;

export function estimateTransactionVerificationGas(approvers: number) {
  return ESTIMATED_VERIFICATION_BASE_GAS + ESTIMATED_PER_APPROVER_GAS * BigInt(approvers);
}
