import { Screen } from '~/components/layout/Screen';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { StackNavigatorScreenProps } from '~/navigation/StackNavigator';
import { HomeAppbar } from './HomeAppbar';
import { QuickActions } from './QuickActions';
import { Tabs } from './Tabs';
import { Splash } from '~/components/Splash';
import { AccountValue } from './AccountValue';
import { Address } from 'lib';
import { NotFound } from '~/components/NotFound';
import { gql } from '@api/generated';
import { useQuery } from '~/gql';
import { persistedAtom } from '~/util/persistedAtom';
import { useAtomValue } from 'jotai';
import { useSyncAtom } from '~/util/useSyncAtom';

const selectedAccount = persistedAtom<Address | null>('selectedAccount', null);

const Query = gql(/* GraphQL */ `
  query Home($account: Address) {
    account(input: { address: $account }) {
      id
      address
      ...HomeAppbar_account
    }

    ...AccountValue_tokensQuery @arguments(account: $account)
  }
`);

export interface HomeScreenParams {
  account?: Address;
}

export type HomeScreenProps = StackNavigatorScreenProps<'Home'>;

export const HomeScreen = withSuspense(({ route }: HomeScreenProps) => {
  const selected = useAtomValue(selectedAccount);
  const query = useQuery(Query, { account: route.params.account ?? (selected || undefined) }).data;
  const { account } = query;

  useSyncAtom(selectedAccount, account?.address ?? null);

  if (!account) return <NotFound name="Account" />;

  return (
    <Screen bottomInset={false}>
      <HomeAppbar account={account} />

      <AccountValue tokensQuery={query} />

      <QuickActions account={account.address} />

      <Tabs account={account.address} />
    </Screen>
  );
}, Splash);
