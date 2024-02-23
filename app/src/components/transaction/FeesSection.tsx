import { FragmentType, gql, useFragment } from '@api/generated';
import { useMutation } from 'urql';
import { TokenItem } from '#/token/TokenItem';
import { useSelectToken } from '~/app/(drawer)/[account]/tokens';
import { createStyles, useStyles } from '@theme/styles';
import { asAddress } from 'lib';
import Decimal from 'decimal.js';
import { Button } from '#/Button';
import { GenericTokenIcon } from '@theme/icons';
import { useToggle } from '~/hooks/useToggle';
import Collapsible from 'react-native-collapsible';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { TokenAmount } from '#/token/TokenAmount';
import { getOptimizedDocument } from '~/gql';

const TransactionProposal = gql(/* GraphQL */ `
  fragment FeesSection_TransactionProposal on TransactionProposal
  @argumentDefinitions(account: { type: "UAddress!" }, includeAccount: { type: "Boolean!" }) {
    id
    status
    account {
      id
      address
    }
    feeToken {
      id
      name
      price {
        id
        eth
      }
      balance(input: { account: $account }) @include(if: $includeAccount)
      ...TokenItem_Token
      ...TokenAmount_token
    }
    updatable
    gasLimit
    maxPaymasterEthFees {
      activation
    }
    estimatedFees {
      id
      maxNetworkEthFee
      ethCreditUsed
      paymasterEthFees {
        total
        activation
      }
    }
    systx {
      id
      maxNetworkEthFee
      ethCreditUsed
      paymasterEthFees {
        total
        activation
      }
      ethPerFeeToken
      usdPerFeeToken
    }
  }
`);

const Update = gql(/* GraphQL */ `
  mutation FeeToken_Update(
    $id: UUID!
    $feeToken: Address!
    $account: UAddress!
    $includeAccount: Boolean!
  ) {
    updateTransaction(input: { id: $id, feeToken: $feeToken }) {
      ...FeesSection_TransactionProposal
        @arguments(account: $account, includeAccount: $includeAccount)
    }
  }
`);
const OptimizedUpdate = getOptimizedDocument(Update);

export interface FeeTokenProps {
  proposal: FragmentType<typeof TransactionProposal>;
}

export function FeesSection(props: FeeTokenProps) {
  const { styles } = useStyles(stylesheet);
  const p = useFragment(TransactionProposal, props.proposal);
  const update = useMutation(OptimizedUpdate)[1];
  const selectToken = useSelectToken();

  const [expanded, toggleExpanded] = useToggle(false);

  const networkEthFee = new Decimal(
    p.transaction?.maxNetworkEthFee ?? p.estimatedFees.maxNetworkEthFee,
  ).neg();
  const paymasterEthFees = p.transaction?.paymasterEthFees ?? p.estimatedFees.paymasterEthFees;
  const ethCreditUsed = new Decimal(p.transaction?.ethCreditUsed ?? p.estimatedFees.ethCreditUsed);
  const ethFees = Decimal.min(networkEthFee.sub(paymasterEthFees.total).add(ethCreditUsed), 0);
  const paymasterFeesEstimatedLabel = !p.transaction ? ' (estimate)' : '';
  const networkFeeEstimatedLabel = !p.transaction ? ' (max)' : '';
  const activationFee = new Decimal(paymasterEthFees.activation).neg();
  const maxActivationFee = new Decimal(p.maxPaymasterEthFees.activation).neg();

  const ethPerFeeToken = new Decimal(p.transaction?.ethPerFeeToken ?? p.feeToken.price?.eth ?? 0);
  const amount = ethFees.div(ethPerFeeToken);
  const insufficient =
    p.status === 'Pending' && p.feeToken.balance && amount.plus(p.feeToken.balance).isNeg();

  return (
    <>
      <TokenItem
        token={p.feeToken}
        amount={amount}
        overline={'Fees' + networkFeeEstimatedLabel}
        onPress={toggleExpanded}
        trailing={({ Trailing }) => (
          <View style={styles.totalTrailingContainer}>
            <Trailing />

            {insufficient && p.feeToken.balance && (
              <Text style={styles.insufficient}>
                <TokenAmount token={p.feeToken} amount={p.feeToken.balance} />
                {' available'}
              </Text>
            )}
          </View>
        )}
      />

      <Collapsible collapsed={!expanded} style={styles.detailsContainer}>
        <View style={styles.row}>
          <Text variant="labelLarge">{'Network fee' + networkFeeEstimatedLabel}</Text>
          <Text variant="bodySmall">
            <TokenAmount token={p.feeToken} amount={networkEthFee.div(ethPerFeeToken)} />
          </Text>
        </View>

        {!maxActivationFee.eq(0) && (
          <View style={styles.row}>
            <Text variant="labelLarge">Activation fee (max)</Text>
            <Text variant="bodySmall">
              <TokenAmount token={p.feeToken} amount={maxActivationFee.div(ethPerFeeToken)} />
            </Text>
          </View>
        )}

        {!activationFee.eq(0) && (
          <View style={styles.row}>
            <Text variant="labelLarge">Activation fee{paymasterFeesEstimatedLabel}</Text>
            <Text variant="bodySmall">
              <TokenAmount token={p.feeToken} amount={activationFee.div(ethPerFeeToken)} />
            </Text>
          </View>
        )}

        {!ethCreditUsed.eq(0) && (
          <View style={styles.row}>
            <Text variant="labelLarge">Credit{paymasterFeesEstimatedLabel}</Text>
            <Text variant="bodySmall">
              <TokenAmount token={p.feeToken} amount={ethCreditUsed.div(ethPerFeeToken)} />
            </Text>
          </View>
        )}
      </Collapsible>

      {p.updatable && (
        <Button
          mode="outlined"
          icon={GenericTokenIcon}
          style={styles.button}
          onPress={async () => {
            const token = await selectToken({ account: p.account.address, feeToken: true });
            if (token)
              await update({
                id: p.id,
                feeToken: asAddress(token),
                account: p.account.address,
                includeAccount: true,
              });
          }}
        >
          Pay fees in another token
        </Button>
      )}
    </>
  );
}

const stylesheet = createStyles(({ colors }) => ({
  totalTrailingContainer: {
    alignItems: 'flex-end',
  },
  insufficient: {
    color: colors.error,
  },
  secondary: {
    color: colors.onSurfaceVariant,
  },
  detailsContainer: {
    gap: 8,
    marginLeft: 72,
    marginRight: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    marginTop: 16,
    marginBottom: 8,
    marginHorizontal: 16,
  },
}));
