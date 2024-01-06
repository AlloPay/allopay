import { useEffect, useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';

import { asChain, ZERO_ADDR } from 'lib';
import { FragmentType, gql, useFragment } from '~/gql/api';
import { POLICY_DRAFT_ATOM, policyAsDraft, PolicyDraft } from '~/lib/policy/draft';
import { usePolicyPresets } from '~/lib/policy/presets';

const Account = gql(/* GraphQL */ `
  fragment useHydratePolicyDraft_Account on Account {
    id
    address
    ...getPolicyPresets_Account
  }
`);

const Policy = gql(/* GraphQL */ `
  fragment useHydratePolicyDraft_Policy on Policy {
    id
    key
    name
    state {
      ...policyAsDraft_PolicyState
    }
    draft {
      ...policyAsDraft_PolicyState
    }
  }
`);

export type PolicyView = 'state' | 'draft';

export interface UseHydratePolicyDraftParams {
  account: FragmentType<typeof Account> | null | undefined;
  policy: FragmentType<typeof Policy> | null | undefined;
  view: PolicyView;
}

export function useHydratePolicyDraft(params: UseHydratePolicyDraftParams) {
  const account = useFragment(Account, params.account);
  const policy = useFragment(Policy, params.policy);
  const presets = usePolicyPresets({
    account,
    chain: account ? asChain(account.address) : 'zksync-goerli', // Should only occur whilst loading
  });

  const init = useMemo(
    (): PolicyDraft => ({
      account: account?.address ?? `zksync-goerli:${ZERO_ADDR}`, // Should only occur whilst loading
      key: policy?.key,
      name: policy?.name || '',
      ...((params.view === 'state' && policy?.state && policyAsDraft(policy.state)) ||
        (policy?.draft && policyAsDraft(policy.draft)) ||
        (policy?.state && policyAsDraft(policy.state)) ||
        presets.low),
    }),
    [
      account?.address,
      policy?.key,
      policy?.name,
      policy?.state,
      policy?.draft,
      params.view,
      presets.low,
    ],
  );

  const setDraft = useSetAtom(POLICY_DRAFT_ATOM);
  useHydrateAtoms([[POLICY_DRAFT_ATOM, init]]);
  useEffect(() => {
    setDraft(init);
  }, [init, setDraft]);

  return { init };
}
