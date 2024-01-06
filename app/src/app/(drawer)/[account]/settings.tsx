import { StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Menu } from 'react-native-paper';
import { match } from 'ts-pattern';
import { useMutation } from 'urql';

import { AccountParams } from '~/app/(drawer)/[account]/(home)/_layout';
import { AppbarMore } from '~/components/Appbar/AppbarMore';
import { AppbarOptions } from '~/components/Appbar/AppbarOptions';
import { Button } from '~/components/Button';
import { Actions } from '~/components/layout/Actions';
import { ScreenSurface } from '~/components/layout/ScreenSurface';
import { ListHeader } from '~/components/list/ListHeader';
import { ListItemHeight } from '~/components/list/ListItem';
import { NotFound } from '~/components/NotFound';
import { PolicyItem } from '~/components/policy/PolicyItem';
import { ScreenSkeleton } from '~/components/skeleton/ScreenSkeleton';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { useQuery } from '~/gql';
import { gql } from '~/gql/api/generated';
import { useLocalParams } from '~/hooks/useLocalParams';
import { EditIcon, NavigateNextIcon } from '~/util/theme/icons';

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

  const query = useQuery(Query, { account: params.account });
  const { account, user } = query.data;
  const isPrimaryAccount = user.primaryAccount?.id === account?.id;

  if (!account) return query.stale ? null : <NotFound name="Account" />;

  return (
    <>
      <AppbarOptions
        mode="large"
        leading="menu"
        headline={account.name}
        trailing={(props) => (
          <AppbarMore iconProps={props}>
            {({ close }) => (
              <Menu.Item
                leadingIcon={EditIcon}
                title="Rename"
                onPress={() => {
                  close();
                  router.push({
                    pathname: `/[account]/name`,
                    params: { account: account.address },
                  });
                }}
              />
            )}
          </AppbarMore>
        )}
      />

      <ScreenSurface>
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
          <Button
            mode="contained"
            onPress={() =>
              router.push({
                pathname: `/(drawer)/[account]/policies/[key]/`,
                params: { account: account.address, key: 'add' },
              })
            }
          >
            Add policy
          </Button>
        </Actions>
      </ScreenSurface>
    </>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingVertical: 8,
  },
});

export default withSuspense(AccountSettingsScreen, ScreenSkeleton);
