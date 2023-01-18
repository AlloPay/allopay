import { Box } from '~/components/layout/Box';
import { ScreenSkeleton } from '~/components/skeleton/ScreenSkeleton';
import { withSkeleton } from '~/components/skeleton/withSkeleton';
import { makeStyles } from '~/util/theme/makeStyles';
import { Address } from 'lib';
import { StackNavigatorScreenProps } from '~/navigation/StackNavigator';
import { ActivateAccountButton } from '~/components/account/ActivateAccountButton';
import { Fab } from '~/components/Fab/Fab';
import { useAccount } from '~/queries/account/useAccount.api';
import { Appbar } from 'react-native-paper';
import { NameIcon, QuorumsIcon, ShareIcon } from '@theme/icons';
import { buildAddrLink } from '~/util/addrLink';
import { Share } from 'react-native';
import { ListItem } from '~/components/list/ListItem';
import { useGoBack } from '~/components/Appbar/useGoBack';

export interface AccountScreenParams {
  account: Address;
}

export type AccountScreenProps = StackNavigatorScreenProps<'Account'>;

export const AccountScreen = withSkeleton(
  ({ navigation: { navigate }, route: { params } }: AccountScreenProps) => {
    const styles = useStyles();
    const account = useAccount(params.account);

    return (
      <Box flex={1}>
        <Appbar.Header mode="large">
          <Appbar.BackAction onPress={useGoBack()} />
          <Appbar.Content title={account.name} />

          <Appbar.Action
            icon={ShareIcon}
            onPress={() => {
              const url = buildAddrLink({ target_address: account.addr });
              Share.share({ url, message: `${account.name}\n${url}` });
            }}
          />
        </Appbar.Header>

        <Box style={styles.list}>
          <ListItem
            leading={NameIcon}
            headline="Rename"
            supporting="Change the name of the account"
            onPress={() => navigate('RenameAccount', { account: account.addr })}
          />

          <ListItem
            leading={QuorumsIcon}
            headline="Quorums"
            supporting="View and configure account quorums"
            trailing={account.quorums.length}
            maxTrailing={100}
            onPress={() => navigate('AccountQuorums', { account: account.addr })}
          />
        </Box>

        <ActivateAccountButton account={account}>{Fab}</ActivateAccountButton>
      </Box>
    );
  },
  ScreenSkeleton,
);

const useStyles = makeStyles(({ space }) => ({
  list: {
    paddingVertical: 8,
  },
}));
