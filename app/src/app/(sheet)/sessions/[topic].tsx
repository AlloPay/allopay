import { Link, Redirect, useRouter } from 'expo-router';
import { getSdkError } from '@walletconnect/utils';
import { ListItem } from '#/list/ListItem';
import { Sheet } from '#/sheet/Sheet';
import {
  WC_NAMESPACE,
  fromCaip10,
  sessionChains,
  updateNamespaces,
  useUpdateWalletConnect,
  useWalletConnect,
} from '~/lib/wc';
import { CloseIcon, DisconnectIcon, ExternalLinkIcon } from '@theme/icons';
import { z } from 'zod';
import { useLocalParams } from '~/hooks/useLocalParams';
import { DappHeader } from '#/walletconnect/DappHeader';
import { Updater, useImmer } from 'use-immer';
import { UAddress } from 'lib';
import { AccountsList } from '#/walletconnect/AccountsList';
import _ from 'lodash';
import { graphql } from 'relay-runtime';
import { useLazyQuery } from '~/api';
import { Topic_SessionDetailsSheetQuery } from '~/api/__generated__/Topic_SessionDetailsSheetQuery.graphql';

const Query = graphql`
  query Topic_SessionDetailsSheetQuery {
    accounts {
      id
      chain
      ...AccountsList_account
    }
  }
`;

const SessionDetailsSheetParams = z.object({ topic: z.string() });

export default function SessionDetailsSheet() {
  const { topic } = useLocalParams(SessionDetailsSheetParams);
  const router = useRouter();
  const client = useWalletConnect();
  const update = useUpdateWalletConnect();
  const pairing = client.core.pairing.getPairings().find((p) => p.topic === topic);
  const session = Object.values(client.getActiveSessions()).find((p) => p.pairingTopic === topic);
  const chains = sessionChains(session);

  const accounts = useLazyQuery<Topic_SessionDetailsSheetQuery>(Query, {}).accounts.filter((a) =>
    chains.includes(a.chain),
  );

  const [selected, _updateSelected] = useImmer<Set<UAddress>>(
    () => new Set(session?.namespaces[WC_NAMESPACE].accounts.map(fromCaip10).filter(Boolean) ?? []),
  );

  const disconnect =
    session &&
    (async () => {
      await client.disconnectSession({
        topic: session.topic,
        reason: getSdkError('USER_DISCONNECTED'),
      });
      update();
    });

  const updateSelected: Updater<Set<UAddress>> = (updater) => {
    _updateSelected((draft) => {
      const initial = [...draft];
      typeof updater === 'function' ? updater(draft) : (draft = updater);

      if (session && !_.isEqual(initial, [...draft])) {
        if (draft.size > 0) {
          client.updateSession({
            topic: session.topic,
            namespaces: updateNamespaces(session.namespaces, [...draft] as UAddress[]),
          });
        } else {
          disconnect?.();
        }
      }
    });
  };

  // Close sheet if the pairing doesn't exist anymore
  if (!pairing) return <Redirect href=".." />;

  const peer = pairing.peerMetadata ?? session?.peer.metadata;

  const forget = async () => {
    router.back();
    disconnect?.();
    await client.core.pairing.disconnect({ topic: pairing.topic });
    update();
  };

  return (
    <Sheet>
      <DappHeader metadata={peer} />

      {accounts.length > 0 && (
        <AccountsList accounts={accounts} selected={selected} updateSelected={updateSelected} />
      )}

      {peer?.url && (
        <Link href={peer.url as `${string}:${string}`} asChild>
          <ListItem leading={ExternalLinkIcon} headline="Open" />
        </Link>
      )}

      {disconnect && (
        <ListItem leading={DisconnectIcon} headline="Disconnect" onPress={disconnect} />
      )}

      {forget && <ListItem leading={CloseIcon} headline="Forget" onPress={forget} />}
    </Sheet>
  );
}

export { ErrorBoundary } from '#/ErrorBoundary';
