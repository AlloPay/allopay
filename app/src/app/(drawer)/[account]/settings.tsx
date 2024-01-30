import { Link, useRouter } from 'expo-router';
import { gql } from '@api/generated';
import { FlashList } from '@shopify/flash-list';
import { EditIcon, NavigateNextIcon } from '@theme/icons';
import { StyleSheet } from 'react-native';
import { NotFound } from '~/components/NotFound';
import { ListHeader } from '~/components/list/ListHeader';
import { ListItemHeight } from '~/components/list/ListItem';
import { useQuery } from '~/gql';
import { PolicyItem } from '~/components/policy/PolicyItem';
import { AppbarOptions } from '~/components/Appbar/AppbarOptions';
import { useLocalParams } from '~/hooks/useLocalParams';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { ScreenSkeleton } from '~/components/skeleton/ScreenSkeleton';
import { ScrollableScreenSurface } from '~/components/layout/ScrollableScreenSurface';
import { Actions } from '~/components/layout/Actions';
import { Button } from '~/components/Button';
import { match } from 'ts-pattern';
import { useMutation } from 'urql';
import { AccountParams } from '~/app/(drawer)/[account]/(home)/_layout';
import { SideSheetLayout } from '~/components/SideSheet/SideSheetLayout';
import { useSideSheetVisibility } from '~/components/SideSheet/useSideSheetVisibility';
import { AccountSettingsSideSheet } from '~/components/account/AccountSettingsSideSheet';

const Query = gql(/* GraphQL */ `
  query AccountSettingsScreen($account: UAddress!) {
    account(input: { account: $account }) {
      id
      address
      name
      policies {
        __typename
        id
        key
        ...PolicyItem_Policy
      }
      ...AccountSettingsSideSheet_Account
    }

    user {
      id
      primaryAccount {
        id
      }
    }
  }
`);

const UpdateUser = gql(/* GraphQL */ `
  mutation AccountSettingsScreen_UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      primaryAccount {
        id
      }
    }
  }
`);

const AccountSettingsScreenParams = AccountParams;

function AccountSettingsScreen() {
  const params = useLocalParams(AccountSettingsScreenParams);
  const router = useRouter();
  const updateUser = useMutation(UpdateUser)[1];
  const sheet = useSideSheetVisibility();

  const query = useQuery(Query, { account: params.account });
  const { account, user } = query.data;
  const isPrimaryAccount = user.primaryAccount?.id === account?.id;

  if (!account) return query.stale ? null : <NotFound name="Account" />;

  return (
    <SideSheetLayout>
      <AppbarOptions
        mode="large"
        leading="menu"
        headline={account.name}
        {...(!sheet.visible && {
          trailing: (props) => <EditIcon {...props} onPress={sheet.open} />,
        })}
      />

      <ScrollableScreenSurface>
        <FlashList
          data={['Policies', ...account.policies]}
          renderItem={({ item }) =>
            match(item)
              .with({ __typename: 'Policy' }, (policy) => (
                <PolicyItem
                  policy={policy}
                  trailing={NavigateNextIcon}
                  onPress={() => {
                    router.push({
                      pathname: `/(drawer)/[account]/policies/[key]/`,
                      params: { account: account.address, key: policy.key },
                    });
                  }}
                />
              ))
              .otherwise((header) => <ListHeader>{header}</ListHeader>)
          }
          estimatedItemSize={ListItemHeight.DOUBLE_LINE}
          keyExtractor={(item) => (typeof item === 'string' ? item : item.id)}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        />

        <Actions>
          {!isPrimaryAccount && (
            <Button
              mode="text"
              onPress={() => updateUser({ input: { primaryAccount: account.address } })}
            >
              Set as primary account
            </Button>
          )}

          <Link
            href={{
              pathname: `/(drawer)/[account]/policies/[key]/`,
              params: { account: account.address, key: 'add' },
            }}
            asChild
          >
            <Button mode="contained">Add policy</Button>
          </Link>
        </Actions>
      </ScrollableScreenSurface>

      <AccountSettingsSideSheet account={account} {...sheet} />
    </SideSheetLayout>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingVertical: 8,
  },
});

export default withSuspense(AccountSettingsScreen, ScreenSkeleton);
