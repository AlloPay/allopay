import { Proposal, useApprove, useReject } from '@api/proposal';
import { useApproverAddress } from '@network/useApprover';
import { Button } from '~/components/Button';
import { Actions } from '~/components/layout/Actions';
import { CHAIN } from '@network/provider';
import { RetryIcon, ShareIcon } from '@theme/icons';
import { Share } from 'react-native';
import { useExecute } from '@api/transaction/useExecute';

export interface ProposalActionsProps {
  proposal: Proposal;
}

export const ProposalActions = ({ proposal }: ProposalActionsProps) => {
  const approver = useApproverAddress();
  const policy = proposal.policy;
  const approve = useApprove();
  const reject = useReject();
  const execute = useExecute();

  const canReject =
    proposal.state === 'pending' && (policy?.responseRequested || proposal.approvals.has(approver));

  const canApprove =
    proposal.state === 'pending' &&
    (policy?.responseRequested || proposal.rejections.has(approver));

  const blockExplorerUrl = CHAIN.blockExplorers?.default.url;

  return (
    <Actions style={{ flexGrow: 0 }}>
      {canReject && <Button onPress={() => reject(proposal)}>Reject</Button>}

      {canApprove && (
        <Button mode="contained" onPress={() => approve(proposal)}>
          Approve
        </Button>
      )}

      {proposal.transaction && blockExplorerUrl && (
        <Button
          mode="contained-tonal"
          icon={ShareIcon}
          onPress={() => {
            const url = `${blockExplorerUrl}/tx/${proposal.transaction!.hash}`;
            Share.share({ message: url, url });
          }}
        >
          Share receipt
        </Button>
      )}

      {proposal.transaction?.status === 'failure' && (
        <Button
          mode="contained"
          icon={RetryIcon}
          onPress={() => execute({ proposalHash: proposal.hash })}
        >
          Retry
        </Button>
      )}
    </Actions>
  );
};
