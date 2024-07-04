import { z } from 'zod';
import { useLocalParams } from '~/hooks/useLocalParams';
import { zUuid } from '~/lib/zod';
import { AppbarMore } from '#/Appbar/AppbarMore';
import { Divider, Menu } from 'react-native-paper';
import { AppbarOptions } from '#/Appbar/AppbarOptions';
import { ScrollableScreenSurface } from '#/layout/ScrollableScreenSurface';
import { MessageStatus } from '#/message/MessageStatus';
import { StyleSheet, View } from 'react-native';
import { DataView } from '#/DataView/DataView';
import { MessageActions } from '#/message/MessageActions';
import { SideSheetLayout } from '#/SideSheet/SideSheetLayout';
import { SideSheet } from '#/SideSheet/SideSheet';
import { ProposalApprovals } from '#/policy/ProposalApprovals';
import { ListHeader } from '#/list/ListHeader';
import { DappHeader } from '#/walletconnect/DappHeader';
import { AccountSection } from '#/proposal/AccountSection';
import { useRemoveMessage } from '#/message/useRemoveMessage';
import { graphql } from 'relay-runtime';
import { useLazyLoadQuery } from 'react-relay';
import { Id_MessageScreenQuery } from '~/api/__generated__/Id_MessageScreenQuery.graphql';

const Query = graphql`
  query Id_MessageScreenQuery($proposal: ID!) {
    message(input: { id: $proposal }) @required(action: THROW) {
      id
      label
      message
      typedData
      account {
        id
        chain
        ...AccountSection_account
      }
      dapp {
        ...DappHeader_dappMetadata
      }
      ...useRemoveMessage_message
      ...MessageStatus_message
      ...MessageActions_message
    }

    user {
      id
      ...MessageActions_user
    }
  }
`;

const MessageScreenParams = z.object({ id: zUuid() });

export default function MessageScreen() {
  const { id } = useLocalParams(MessageScreenParams);

  const { message: p, user } = useLazyLoadQuery<Id_MessageScreenQuery>(Query, { proposal: id });
  const remove = useRemoveMessage(p);

  return (
    <SideSheetLayout defaultVisible>
      <AppbarOptions
        headline={(props) => <MessageStatus message={p} {...props} />}
        mode="large"
        {...(remove && {
          trailing: (props) => (
            <AppbarMore iconProps={props}>
              {({ handle }) => <Menu.Item title="Remove" onPress={handle(remove)} />}
            </AppbarMore>
          ),
        })}
      />

      <ScrollableScreenSurface contentContainerStyle={styles.sheet}>
        {p.dapp && <DappHeader dapp={p.dapp} action="wants you to sign" />}

        <AccountSection account={p.account} />
        <Divider horizontalInset style={styles.divider} />

        <View style={styles.messageContainer}>
          <ListHeader>Message</ListHeader>
          <DataView chain={p.account.chain} style={styles.messageData}>
            {p.typedData ?? p.message}
          </DataView>
        </View>

        <MessageActions message={p} user={user} />
      </ScrollableScreenSurface>

      <SideSheet headline="Approvals">
        <ProposalApprovals proposal={id} />
      </SideSheet>
    </SideSheetLayout>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingVertical: 8,
  },
  divider: {
    marginVertical: 8,
  },
  messageContainer: {
    gap: 8,
  },
  messageData: {
    marginHorizontal: 16,
  },
});

export { ErrorBoundary } from '#/ErrorBoundary';
