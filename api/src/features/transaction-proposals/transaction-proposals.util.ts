import Decimal from 'decimal.js';
import { Operation, asAddress, asFp, asHex, asTx } from 'lib';
import { ETH } from 'lib/dapps';
import e, { $infer } from '~/edgeql-js';

export const proposalTxShape = e.shape(e.TransactionProposal, () => ({
  operations: {
    to: true,
    value: true,
    data: true,
  },
  nonce: true,
  gasLimit: true,
  paymaster: true,
  paymasterFee: true,
  feeToken: { address: true },
}));

const s = e.select(e.TransactionProposal, proposalTxShape);
export type ProposalTxShape = NonNullable<$infer<typeof s>>[0];

export const transactionProposalAsTx = (p: ProposalTxShape) =>
  asTx({
    operations: p.operations.map(
      (op): Operation => ({
        to: asAddress(op.to),
        value: op.value ?? undefined,
        data: op.data ? asHex(op.data) : undefined,
      }),
    ) as [Operation, ...Operation[]],
    nonce: p.nonce,
    gas: p.gasLimit,
    paymaster: asAddress(p.paymaster),
    paymasterFee: asFp(new Decimal(p.paymasterFee), ETH),
    feeToken: asAddress(p.feeToken.address),
  });
