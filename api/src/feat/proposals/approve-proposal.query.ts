// GENERATED by @edgedb/generate v0.5.4

import type {Executor} from "edgedb";

export type ApproveProposalArgs = {
  readonly "proposal": string;
  readonly "approver": string;
  readonly "signature": string;
};

export type ApproveProposalReturns = {
  "approval": string;
  "proposal": {
    "id": string;
    "account": {
      "address": string;
    };
  } | null;
};

export function approveProposal(client: Executor, args: ApproveProposalArgs): Promise<ApproveProposalReturns> {
  return client.queryRequiredSingle(`\
with proposal := (select Proposal filter .id = <uuid>$proposal),
     approver := (select Approver filter .address = <Address>$approver)
    #  deletedResponse := (delete ProposalResponse filter .proposal = proposal and .approver = approver).id
select {
  approval := (
    insert Approval {
      proposal := proposal,
      approver := approver,
      signedHash := proposal.hash,
      signature := <Bytes>$signature
    }
  ).id,
  proposal := (
    id := proposal.id,
    account := { address := proposal.account.address }
  )
}`, args);

}
