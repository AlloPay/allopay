import { gql } from '@apollo/client';
import { useTxsMetadataQuery } from '@gql/generated.api';
import { useApiClient } from '@gql/GqlProvider';
import { address, toId } from 'lib';
import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { TxMetadata } from '.';
import { useAccountIds } from '../account/useAccountIds';

export const API_QUERY_TX_IDS = gql`
  query TxsMetadata($accounts: [Address!]!) {
    txs(accounts: $accounts) {
      id
      accountId
      hash
      createdAt
    }
  }
`;

export const useApiTxsMetadata = () => {
  const accounts = useAccountIds();

  const { data, ...rest } = useTxsMetadataQuery({
    client: useApiClient(),
    variables: { accounts },
  });

  const txs = useMemo(
    (): TxMetadata[] =>
      data?.txs.map(
        (tx): TxMetadata => ({
          id: toId(tx.id),
          account: address(tx.accountId),
          hash: tx.hash,
          timestamp: DateTime.fromISO(tx.createdAt),
        }),
      ) ?? [],
    [data?.txs],
  );

  return { txs, ...rest };
};
