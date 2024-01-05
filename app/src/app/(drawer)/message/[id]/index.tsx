import { z } from 'zod';
import { MessageLayoutParams } from '~/app/(drawer)/message/[id]/_layout';
import { useLocalParams } from '~/hooks/useLocalParams';
import { ScrollView, StyleSheet, View } from 'react-native';
import { gql } from '@api/generated';
import { useQuery } from '~/gql';
import { DataView } from '~/components/DataView/DataView';
import { Text } from 'react-native-paper';
import { MessageIcon } from '~/components/message/MessageIcon';
import { RiskRating } from '~/components/proposal/RiskRating';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { ScreenSkeleton } from '~/components/skeleton/ScreenSkeleton';
import { asChain } from 'lib';

const Query = gql(/* GraphQL */ `
  query MessageDetailsTab($proposal: UUID!) {
    messageProposal(input: { id: $proposal }) {
      id
      label
      message
      typedData
      account {
        id
        address
      }
      ...MessageIcon_MessageProposal
      ...RiskRating_Proposal
    }
  }
`);

export const MessageDetailsTabParams = MessageLayoutParams;
export type MessageDetailsTabParams = z.infer<typeof MessageDetailsTabParams>;

function MessageDetailsTab() {
  const params = useLocalParams(MessageDetailsTabParams);
  const p = useQuery(Query, { proposal: params.id }).data?.messageProposal;

  if (!p) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <MessageIcon proposal={p} />
        <Text>
          <Text variant="titleMedium">{p.label || 'Message'}</Text>
        </Text>
      </View>

      <DataView chain={asChain(p.account.address)}>{p.typedData ?? p.message}</DataView>

      <RiskRating proposal={p} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 16,
    marginHorizontal: 16,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
});

export default withSuspense(MessageDetailsTab, <ScreenSkeleton />);
