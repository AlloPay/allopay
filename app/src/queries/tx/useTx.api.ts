import { gql } from '@apollo/client';
import { useDevice } from '@features/device/useDevice';
import { useTxQuery } from '@gql/generated.api';
import { useApiClient } from '@gql/GqlProvider';
import { BigNumber } from 'ethers';
import { address, toId, toTxSalt } from 'lib';
import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { Approval, ProposedTx, TxId } from '.';

export const API_TX_FIELDS = gql`
  fragment TxFields on Tx {
    id
    accountId
    hash
    to
    value
    data
    salt
    approvals {
      userId
      signature
      createdAt
    }
    createdAt
    submissions {
      id
      hash
      nonce
      gasLimit
      gasPrice
      finalized
      createdAt
    }
  }
`;

export const API_QUERY_TX = gql`
  ${API_TX_FIELDS}

  query Tx($account: Address!, $hash: Bytes32!) {
    tx(account: $account, hash: $hash) {
      ...TxFields
    }
  }
`;

export const useApiTx = (id: TxId) => {
  const device = useDevice();

  const { data, ...rest } = useTxQuery({
    client: useApiClient(),
    variables: {
      account: id.account,
      hash: id.hash,
    },
  });

  const tx = useMemo((): ProposedTx | undefined => {
    const tx = data?.tx;
    if (!tx) return undefined;

    const timestamp = DateTime.fromISO(tx.createdAt);

    const approvals: Approval[] =
      tx.approvals?.map((a) => ({
        addr: address(a.userId),
        signature: a.signature,
        timestamp: DateTime.fromISO(a.createdAt),
      })) ?? [];

    return {
      id: toId(tx.id),
      account: address(tx.accountId),
      hash: tx.hash,
      to: address(tx.to),
      value: BigNumber.from(tx.value),
      data: tx.data,
      salt: toTxSalt(tx.salt),
      approvals,
      userHasApproved: !!approvals.find((a) => a.addr === device.address),
      submissions:
        tx.submissions?.map((s) => ({
          hash: s.hash,
          nonce: s.nonce,
          gasLimit: BigNumber.from(s.gasLimit),
          gasPrice: s.gasPrice ? BigNumber.from(s.gasPrice) : undefined,
          finalized: s.finalized,
          createdAt: DateTime.fromISO(s.createdAt),
        })) ?? [],
      proposedAt: timestamp,
      timestamp,
    };
  }, [data?.tx, device.address]);

  return { tx, ...rest };
};
