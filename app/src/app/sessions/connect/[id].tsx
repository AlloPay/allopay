import { useEffect } from 'react';
import { SignClientTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { useRouter } from 'expo-router';
import { Text } from 'react-native-paper';
import { useImmer } from 'use-immer';
import { z } from 'zod';

import { tryOrCatchAsync } from 'lib';
import { Button } from '~/components/Button';
import { Actions } from '~/components/layout/Actions';
import { showError, showSuccess } from '~/components/provider/SnackbarProvider';
import { Sheet } from '~/components/sheet/Sheet';
import { AccountsList } from '~/components/walletconnect/AccountsList';
import { PeerHeader } from '~/components/walletconnect/PeerHeader';
import { useQuery } from '~/gql';
import { gql } from '~/gql/api/generated';
import { useLocalParams } from '~/hooks/useLocalParams';
import { zArray, zChain } from '~/lib/zod';
import { createStyles, useStyles } from '~/util/theme/styles';
import { toNamespaces, useUpdateWalletConnect, useWalletConnect } from '~/util/walletconnect';

const Query = gql(/* GraphQL */ `
  query ConnectSessionSheet {
    accounts {
      id
      address
      ...AccountsList_Account
    }
  }
`);

const ConnectSessionSheetParams = z.object({
  id: z.coerce.number(),
  chains: zArray(zChain()),
});

export default function ConnectSessionSheet() {
  const { id, chains } = useLocalParams(ConnectSessionSheetParams);
  const { styles } = useStyles(stylesheet);
  const router = useRouter();
  const client = useWalletConnect();
  const update = useUpdateWalletConnect();
  const proposal = client.proposal.get(id);

  const { accounts } = useQuery(Query).data;

  const [selected, updateSelected] = useImmer(new Set(accounts.map((a) => a.address)));

  useEffect(() => {
    const handleExpiry = (args: SignClientTypes.EventArguments['proposal_expire']) => {
      if (args.id === id) {
        showError('DApp connection proposal expired, please try again');
        router.back();
      }
    };

    client.on('proposal_expire', handleExpiry);

    return () => {
      client.off('proposal_expire', handleExpiry);
    };
  }, [client, id, router]);

  const connect = async () => {
    const req = await tryOrCatchAsync(
      () => client.approve({ id, namespaces: toNamespaces(selected) }),
      (error) => showError('Failed to connect to DApp, please try again', { event: { error } }),
    );
    router.back();

    if (req) {
      try {
        await req.acknowledged();
        update();
        showSuccess('Connected');
      } catch (error) {
        showError('DApp failed to acknowledge connection, please try again', { event: { error } });
      }
    }
  };

  const reject = () => {
    client.reject({ id, reason: getSdkError('USER_REJECTED') });
    router.back();
  };

  if (!proposal) return null;

  const hasPaired = !!client.pairing.getAll({ topic: proposal.pairingTopic })?.[0];

  return (
    <Sheet onClose={reject}>
      <PeerHeader peer={proposal.proposer.metadata}>wants to connect</PeerHeader>

      {!hasPaired && (
        <Text variant="labelLarge" style={styles.pairWarning}>
          This is your first time connecting to this DApp
        </Text>
      )}

      <AccountsList
        accounts={accounts}
        selected={selected}
        updateSelected={updateSelected}
        chains={chains}
      />

      <Actions>
        <Button mode="contained" onPress={connect} disabled={selected.size === 0}>
          Connect
        </Button>
      </Actions>
    </Sheet>
  );
}

const stylesheet = createStyles(({ colors }) => ({
  pairWarning: {
    marginHorizontal: 16,
    textAlign: 'center',
    color: colors.warning,
  },
}));
