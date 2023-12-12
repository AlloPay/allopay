import { FragmentType, gql, useFragment } from '@api/generated';
import { createStyles } from '@theme/styles';
import Decimal from 'decimal.js';
import { Text } from 'react-native-paper';
import { FiatValue } from '~/components/FiatValue';

const Query = gql(/* GraphQL */ `
  fragment AccountValue_Query on Query @argumentDefinitions(account: { type: "UAddress!" }) {
    tokens {
      id
      balance(input: { account: $account })
      price {
        id
        usd {
          id
          current
        }
      }
    }
  }
`);

export interface AccountValueProps {
  query: FragmentType<typeof Query>;
}

export function AccountValue(props: AccountValueProps) {
  const { tokens } = useFragment(Query, props.query);

  const total = Decimal.sum(
    ...tokens.map((t) => new Decimal(t.balance).mul(t.price?.usd.current ?? 0)),
  );

  return (
    <Text variant="displayMedium" style={styles.text}>
      <FiatValue value={total} />
    </Text>
  );
}

const styles = createStyles({
  text: {
    margin: 16,
  },
});
