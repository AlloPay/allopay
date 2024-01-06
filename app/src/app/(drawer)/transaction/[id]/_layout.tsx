import { ScrollView, StyleSheet } from 'react-native';
import { z } from 'zod';

import { AppbarMore } from '~/components/Appbar/AppbarMore';
import { AppbarOptions } from '~/components/Appbar/AppbarOptions';
import { ScreenSurface } from '~/components/layout/ScreenSurface';
import { TopTabs } from '~/components/layout/TopTabs';
import { NotFound } from '~/components/NotFound';
import { RemoveTransactionItem } from '~/components/transaction/RemoveTransactionItem';
import { TransactionActions } from '~/components/transaction/TansactionActions';
import { TransactionStatus } from '~/components/transaction/TransactionStatus';
import { useQuery } from '~/gql';
import { gql } from '~/gql/api/generated';
import { useLocalParams } from '~/hooks/useLocalParams';
import { zUuid } from '~/lib/zod';

const Query = gql(/* GraphQL */ `
  query TransactionLayout($proposal: UUID!) {
    transactionProposal(input: { id: $proposal }) {
      id
      account {
        id
        name
      }
      ...TransactionStatus_TransactionProposal
      ...TransactionActions_TransactionProposal @arguments(proposal: $proposal)
    }

    user {
      id
      ...TransactionActions_User
    }
  }
`);

export const TransactionLayoutParams = z.object({ id: zUuid() });

export default function TransactionLayout() {
  const { id } = useLocalParams(TransactionLayoutParams);

  const query = useQuery(Query, { proposal: id });
  const { transactionProposal: proposal, user } = query.data;

  if (!proposal) return query.stale ? null : <NotFound name="Proposal" />;

  return (
    <>
      <AppbarOptions
        headline={proposal.account.name}
        trailing={(props) => (
          <AppbarMore iconProps={props}>
            {({ close }) => <RemoveTransactionItem proposal={id} close={close} />}
          </AppbarMore>
        )}
      />

      <ScreenSurface>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <TransactionStatus proposal={proposal} />

          <TopTabs>
            <TopTabs.Screen
              name="index"
              options={{ title: 'Transaction' }}
              initialParams={{ id }}
            />
            <TopTabs.Screen
              name="approvals"
              options={{ title: 'Approvals' }}
              initialParams={{ id }}
            />
          </TopTabs>

          <TransactionActions proposal={proposal} user={user} />
        </ScrollView>
      </ScreenSurface>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
});
