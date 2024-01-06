import { AbiParameterToPrimitiveType, parseAbiParameters, TypedData } from 'abitype';
import {
  CompactSignature,
  encodeAbiParameters,
  encodeFunctionData,
  getAbiItem,
  isHex,
  TypedDataDefinition,
} from 'viem';

import { CHAINS } from 'chains';
import { Address, asAddress, asChain, UAddress } from './address';
import { Hex } from './bytes';
import { abi as flowAbi } from './generated/IPaymasterFlow';
import { abi as paymasterUtilAbi } from './generated/TestPaymasterUtil';

export interface PayForTransactionParams extends PaymasterSignedData {
  token: Address;
  amount: bigint;
  paymasterSignature: CompactSignature;
}

export function encodePaymasterInput(params: PayForTransactionParams): Hex {
  return encodeFunctionData({
    abi: flowAbi,
    functionName: 'payForTransaction',
    args: [
      params.token,
      params.amount,
      { paymasterFee: params.paymasterFee, discount: params.discount },
      params.paymasterSignature,
    ],
  });
}

const hashSignedDataAbi = getAbiItem({ abi: paymasterUtilAbi, name: 'hashSignedData' }).inputs;

export type PaymasterSignedData = AbiParameterToPrimitiveType<(typeof hashSignedDataAbi)[2]>;

const SIGNED_DATA_TYPES = {
  SignedData: [
    { name: 'account', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'paymasterFee', type: 'uint256' },
    { name: 'discount', type: 'uint256' },
  ],
} satisfies TypedData;

interface SignedDataMessage extends PaymasterSignedData {
  account: Address;
  nonce: bigint;
}

export interface HashPaymasterSignedDataParams extends SignedDataMessage {
  paymaster: UAddress;
}

export function paymasterSignedDataAsTypedData({
  paymaster,
  ...message
}: HashPaymasterSignedDataParams) {
  return {
    domain: {
      chainId: CHAINS[asChain(paymaster)].id,
      verifyingContract: asAddress(paymaster),
    },
    types: SIGNED_DATA_TYPES,
    primaryType: 'SignedData' as const,
    message,
  } satisfies TypedDataDefinition;
}

export interface PaymasterSignedInputParams {
  token: Address;
  paymasterFee: bigint;
}

export function paymasterSignedInput(params: PaymasterSignedInputParams | Hex): Hex {
  if (isHex(params)) return params;

  return encodeAbiParameters(parseAbiParameters('address token, uint256 paymasterFee'), [
    params.token,
    params.paymasterFee,
  ]);
}
