import { useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';

import { UAddress } from 'lib';
import CreateAccountScreen from '~/app/(drawer)/accounts/create';
import { ScreenSkeleton } from '~/components/skeleton/ScreenSkeleton';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { useQuery } from '~/gql';
import { gql } from '~/gql/api';
import { useSetSelectedAccont } from '~/hooks/useSelectedAccount';

const Query = gql(/* GraphQL */ `
  query AccountOnboarding {
    accounts {
      id
      address
    }
  }
`);

function AccountOnboardingScreen() {
  const router = useRouter();
  const setSelected = useSetSelectedAccont();

  const { accounts } = useQuery(Query).data;

  const next = useCallback(
    (account: UAddress) => {
      setSelected(account);
      router.push(`/onboard/(drawer)/auth`);
    },
    [router, setSelected],
  );

  useEffect(() => {
    if (accounts.length) next(accounts[0].address);
  }, [accounts, next]);

  return <CreateAccountScreen onCreate={next} />;
}

export default withSuspense(AccountOnboardingScreen, <ScreenSkeleton />);
