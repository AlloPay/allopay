import { FlashList } from '@shopify/flash-list';
import { ListItemHeight } from '~/components/list/ListItem';
import { TokenItem } from '~/components/token/TokenItem';
import { TabNavigatorScreenProp } from '.';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { TabScreenSkeleton } from '~/components/tab/TabScreenSkeleton';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Address, tokenToFiat } from 'lib';
import { gql } from '@api/generated';
import { useQuery, usePollQuery } from '~/gql';

const Query = gql(/* GraphQL */ `
  query TokensTab($account: Address!) {
    tokens {
      id
      decimals
      price {
        id
        current
      }
      balance(input: { account: $account })
      ...TokenItem_token
    }
  }
`);

export interface TokensTabParams {}

export type TokensTabProps = TabNavigatorScreenProp<'Tokens'> & { account: Address };

export const TokensTab = withSuspense(
  (props: TokensTabProps) => {
    const { data, reexecute } = useQuery(Query, { account: props.account });
    usePollQuery(reexecute, 15000);

    const tokens = (data.tokens ?? [])
      .map((t) => ({
        ...t,
        value: tokenToFiat(t.balance, t.price?.current ?? 0, t.decimals),
      }))
      .sort((a, b) => b.value - a.value);

    return (
      <FlashList
        data={tokens}
        renderItem={({ item }) => <TokenItem token={item} amount={item.balance} />}
        ListEmptyComponent={
          <Text variant="titleMedium" style={styles.emptyText}>
            You have no tokens{'\n'}
            Receive tokens to get started
          </Text>
        }
        contentContainerStyle={styles.contentContainer}
        estimatedItemSize={ListItemHeight.DOUBLE_LINE}
        getItemType={(item) => item.__typename}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
      />
    );
  },
  (props) => (
    <TabScreenSkeleton {...props} listItems={{ leading: true, supporting: true, trailing: true }} />
  ),
);

const styles = StyleSheet.create({
  contentContainer: {
    paddingVertical: 8,
  },
  emptyText: {
    margin: 16,
    textAlign: 'center',
  },
});
