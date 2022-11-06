import { Box } from '~/components/layout/Box';
import { EmptyListFallback } from '~/components/EmptyListFallback';
import { ListScreenSkeleton } from '~/components/skeleton/ListScreenSkeleton';
import { withSkeleton } from '~/components/skeleton/withSkeleton';
import { ActivityIcon } from '~/util/theme/icons';
import { makeStyles } from '~/util/theme/makeStyles';
import { useMemo } from 'react';
import { SectionList } from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import { AppbarMenu } from '~/components/Appbar/AppbarMenu';
import { useAppbarHeader } from '~/components/Appbar/useAppbarHeader';
import { ProposalItem } from '~/screens/activity/ProposalItem';
import { ProposalMetadata } from '~/queries/proposal';
import { useRootNavigation } from '~/navigation/useRootNavigation';
import { useTransfersMetadata } from '~/queries/transfer/useTransfersMetadata.sub';
import { TransferType } from '~/gql/generated.sub';
import { TransferMetadata } from '~/queries/transfer/useTransfersMetadata.sub';
import { IncomingTransferItem } from './IncomingTransferItem';
import { useProposalsMetadata } from '~/queries/proposal/useProposalsMetadata.api';
import { ProposalStatus } from '~/gql/generated.api';
import { match } from 'ts-pattern';

type Item =
  | {
      activity: ProposalMetadata;
      type: 'proposal';
    }
  | {
      activity: TransferMetadata;
      type: 'transfer';
    };

export const ActivityScreen = withSkeleton(() => {
  const styles = useStyles();
  const { AppbarHeader, handleScroll } = useAppbarHeader();
  const navigation = useRootNavigation();
  const [proposalsAwaitingUser] = useProposalsMetadata({ status: ProposalStatus.AwaitingUser });
  const [proposalsAwaitingOthers] = useProposalsMetadata({ status: ProposalStatus.AwaitingOther });
  const [proposalsExecuted] = useProposalsMetadata({ status: ProposalStatus.Executed });
  // const [incomingTransfers] = useTransfersMetadata(TransferType.In);

  const sections = useMemo(
    () =>
      [
        {
          title: 'Awaiting approval',
          data: [...proposalsAwaitingUser, ...proposalsAwaitingOthers].map(
            (activity): Item => ({ activity, type: 'proposal' }),
          ),
        },
        {
          title: 'Executed',
          data: [
            ...proposalsExecuted.map((activity): Item => ({ activity, type: 'proposal' })),
            // ...incomingTransfers.map((activity): Item => ({ activity, type: 'transfer' })),
          ].sort((a, b) => b.activity.timestamp.toMillis() - a.activity.timestamp.toMillis()),
        },
      ].filter((section) => section.data.length > 0),
    [proposalsAwaitingUser, proposalsAwaitingOthers, proposalsExecuted],
  );

  return (
    <Box flex={1}>
      <AppbarHeader mode="center-aligned">
        <AppbarMenu />
        <Appbar.Content title="Activity" />
      </AppbarHeader>

      <SectionList
        renderSectionHeader={({ section }) => (
          <Text variant="bodyLarge" style={styles.title}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) =>
          match(item)
            .with({ type: 'proposal' }, ({ activity }) => (
              <ProposalItem
                id={activity}
                onPress={() => navigation.navigate('Proposal', { id: activity })}
              />
            ))
            .with({ type: 'transfer' }, ({ activity }) => <IncomingTransferItem id={activity.id} />)
            .exhaustive()
        }
        ListEmptyComponent={
          <EmptyListFallback
            Icon={ActivityIcon}
            title="No activity to show"
            subtitle="Check back later!"
            isScreenRoot
          />
        }
        sections={sections}
        onScroll={handleScroll}
        showsVerticalScrollIndicator={false}
      />
    </Box>
  );
}, ListScreenSkeleton);

const useStyles = makeStyles(({ space }) => ({
  title: {
    marginHorizontal: space(2),
    marginBottom: space(1),
  },
}));
