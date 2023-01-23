import gql from 'graphql-tag';
import { useSuspenseQuery } from './useSuspenseQuery';
import {
  CreateTestAccountMutation,
  CreateTestAccountMutationVariables,
  FirstAccountQuery,
  FirstAccountQueryVariables,
} from '../api.generated';
import { useMutation } from '@apollo/client';
import { useDevice } from '../hooks/useDevice';
import { useEffect, useState } from 'react';

const useFirstAccount = (): string | undefined =>
  useSuspenseQuery<FirstAccountQuery, FirstAccountQueryVariables>(
    gql`
      query FirstAccount {
        accounts(take: 1) {
          id
        }
      }
    `,
    {
      variables: {},
    },
  ).data.accounts[0]?.id;

const useCreateAccount = () =>
  useMutation<CreateTestAccountMutation, CreateTestAccountMutationVariables>(
    gql`
      mutation CreateTestAccount($name: String!, $quorums: [QuorumInput!]!) {
        createAccount(name: $name, quorums: $quorums) {
          id
        }
      }
    `,
    {
      variables: {
        name: 'Test account',
        quorums: [{ name: 'Test quorum', approvers: [useDevice().address] }],
      },
    },
  );

export const useAccount = () => {
  // Query for an account
  const firstAccount = useFirstAccount();
  const [createAccount] = useCreateAccount();

  // Create an account if one doesn't exist
  const [account, setAccount] = useState<string | undefined>(firstAccount);
  useEffect(() => {
    (async () => {
      if (!account) {
        const { data } = await createAccount();
        if (data) setAccount(data.createAccount.id);
      }
    })();
  }, [account, createAccount]);

  return account;
};
