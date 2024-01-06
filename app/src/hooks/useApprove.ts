import { match } from 'ts-pattern';
import { useMutation } from 'urql';

import { Address } from 'lib';
import { useGetLedgerApprover } from '~/app/ledger/approve';
import { showError } from '~/components/provider/SnackbarProvider';
import { useSignWithApprover } from '~/components/transaction/useSignWithApprover';
import { FragmentType, gql, useFragment } from '~/gql/api';
import { useGetAppleApprover } from '~/hooks/cloud/useGetAppleApprover';
import { useGetGoogleApprover } from '~/hooks/cloud/useGetGoogleApprover';
import { ampli } from '~/lib/ampli';
import { useApproverAddress } from '~/lib/network/useApprover';
import { proposalAsTypedData } from '~/lib/proposalAsTypedData';

const User = gql(/* GraphQL */ `
  fragment UseApprove_User on User {
    id
    approvers {
      id
      address
      bluetoothDevices
      cloud {
        id
        provider
        subject
      }
    }
  }
`);

const Proposal = gql(/* GraphQL */ `
  fragment UseApprove_Proposal on Proposal {
    __typename
    id
    potentialApprovers {
      id
    }
    ... on TransactionProposal {
      updatable
    }
    ... on MessageProposal {
      updatable
      message
      typedData
    }
    ...proposalAsTypedData_TransactionProposal
  }
`);

const ApproveTransaction = gql(/* GraphQL */ `
  mutation UseApprove_ApproveTransaction($input: ApproveInput!) {
    approveTransaction(input: $input) {
      id
      approvals {
        id
      }
      rejections {
        id
      }
    }
  }
`);

const ApproveMessage = gql(/* GraphQL */ `
  mutation UseApprove_ApproveMessage($input: ApproveInput!) {
    approveMessage(input: $input) {
      id
      approvals {
        id
      }
      rejections {
        id
      }
    }
  }
`);

export interface UseApproveParams {
  user: FragmentType<typeof User>;
  proposal: FragmentType<typeof Proposal>;
  approver: Address;
}

export function useApprove({ approver, ...params }: UseApproveParams) {
  const user = useFragment(User, params.user);
  const p = useFragment(Proposal, params.proposal);
  const device = useApproverAddress();
  const signWithDevice = useSignWithApprover();
  const getLedgerApprover = useGetLedgerApprover();
  const approveTransaction = useMutation(ApproveTransaction)[1];
  const approveMessage = useMutation(ApproveMessage)[1];
  const approve = p.__typename === 'TransactionProposal' ? approveTransaction : approveMessage;
  const getAppleApprover = useGetAppleApprover();
  const getGoogleApprover = useGetGoogleApprover();
  const type = p.__typename === 'TransactionProposal' ? 'Transaction' : 'Message';

  const userApprover = user.approvers.find((a) => a.address === approver);
  const canApprove =
    p.updatable && !!userApprover && !!p.potentialApprovers.find((a) => a.id === userApprover.id);

  if (!userApprover || !p.updatable || !canApprove) return undefined;

  if (approver === device) {
    return async () => {
      const signature = await match(p)
        .with({ __typename: 'TransactionProposal' }, (p) =>
          signWithDevice.signTypedData(proposalAsTypedData(p)),
        )
        .with({ __typename: 'MessageProposal' }, (p) =>
          p.typedData
            ? signWithDevice.signTypedData(p.typedData)
            : signWithDevice.signMessage({ message: p.message }),
        )
        .exhaustive();
      if (signature.isOk()) {
        await approve({ input: { id: p.id, signature: signature.value } });
        ampli.approval({ type, method: 'Device' });
      }
    };
  } else if (userApprover?.bluetoothDevices?.length) {
    return async () => {
      const { signTypedData, signMessage } = await getLedgerApprover({ device: approver });

      const signature = await match(p)
        .with({ __typename: 'TransactionProposal' }, (p) => signTypedData(proposalAsTypedData(p)))
        .with({ __typename: 'MessageProposal' }, (p) =>
          p.typedData ? signTypedData(p.typedData) : signMessage({ message: p.message }),
        )
        .exhaustive();
      if (signature) {
        await approve({ input: { id: p.id, approver, signature } });
        ampli.approval({ type, method: 'Ledger' });
      }
    };
  } else if (userApprover.cloud) {
    return match(userApprover.cloud)
      .with({ provider: 'Apple' }, ({ subject }) => {
        if (!getAppleApprover) return undefined;

        return async () => {
          const r = await getAppleApprover({ subject });
          if (r.isErr())
            return showError('Failed to approve with Apple account', {
              event: { error: r.error, subject },
            });

          const { approver } = r.value;

          const signature = await match(p)
            .with({ __typename: 'TransactionProposal' }, (p) =>
              approver.signTypedData(proposalAsTypedData(p)),
            )
            .with({ __typename: 'MessageProposal' }, (p) =>
              p.typedData
                ? approver.signTypedData(p.typedData)
                : approver.signMessage({ message: p.message }),
            )
            .exhaustive();

          await approve({
            input: { id: p.id, approver: approver.address, signature },
          });
          ampli.approval({ type, method: 'Apple' });
        };
      })
      .with({ provider: 'Google' }, ({ subject }) => {
        if (!getGoogleApprover) return undefined;

        return async () => {
          const r = await getGoogleApprover({ subject });
          if (r.isErr())
            return showError('Failed to approve with Google account', {
              event: { error: r.error, subject },
            });

          const { approver } = r.value;

          const signature = await match(p)
            .with({ __typename: 'TransactionProposal' }, (p) =>
              approver.signTypedData(proposalAsTypedData(p)),
            )
            .with({ __typename: 'MessageProposal' }, (p) =>
              p.typedData
                ? approver.signTypedData(p.typedData)
                : approver.signMessage({ message: p.message }),
            )
            .exhaustive();

          await approve({
            input: { id: p.id, approver: approver.address, signature },
          });
          ampli.approval({ type, method: 'Google' });
        };
      })
      .exhaustive();
  }
}
