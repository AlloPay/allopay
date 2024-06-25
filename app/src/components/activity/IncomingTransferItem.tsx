import { useAddressLabel } from '#/address/AddressLabel';
import { Timestamp } from '#/format/Timestamp';
import { ListItem, ListItemProps } from '#/list/ListItem';
import { ListItemSkeleton } from '#/list/ListItemSkeleton';
import { withSuspense } from '#/skeleton/withSuspense';
import { FiatValue } from '#/FiatValue';
import { FragmentType, gql, useFragment } from '@api/generated';
import { asUAddress } from 'lib';
import { createStyles } from '@theme/styles';
import { View } from 'react-native';
import { FilledIcon } from '#/FilledIcon';
import { ReceiveIcon } from '@theme/icons';
import { AddressIcon } from '#/Identicon/AddressIcon';
import { ICON_SIZE } from '@theme/paper';
import { useFormattedTokenAmount } from '#/token/TokenAmount';

const Transfer = gql(/* GraphQL */ `
  fragment IncomingTransferItem_Transfer on Transfer {
    account {
      id
      chain
    }
    token {
      id
      ...UseFormattedTokenAmount_token
    }
    from
    timestamp
    amount
    value
  }
`);

export interface IncomingTransferItemProps extends Partial<ListItemProps> {
  transfer: FragmentType<typeof Transfer>;
}

function IncomingTransferItem_(props: IncomingTransferItemProps) {
  const transfer = useFragment(Transfer, props.transfer);
  const from = useAddressLabel(asUAddress(transfer.from, transfer.account.chain));
  const amount = useFormattedTokenAmount({ token: transfer.token, amount: transfer.amount });

  return (
    <ListItem
      leading={
        <View>
          <AddressIcon address={transfer.from} />
          <FilledIcon
            icon={ReceiveIcon}
            size={(ICON_SIZE.medium * 10) / 24}
            style={styles.overlayed(ICON_SIZE.medium)}
          />
        </View>
      }
      headline={`Received ${amount} from ${from}`}
      supporting={<Timestamp timestamp={transfer.timestamp} />}
      trailing={({ Text }) =>
        transfer.value !== null && transfer.value !== undefined ? (
          <Text variant="labelLarge">
            <FiatValue value={transfer.value} />
          </Text>
        ) : null
      }
      {...props}
    />
  );
}

const styles = createStyles({
  overlayed: (size: number) => ({
    position: 'absolute',
    bottom: 0,
    right: 0,
    marginTop: -size,
  }),
});

export const IncomingTransferItem = withSuspense(
  IncomingTransferItem_,
  <ListItemSkeleton leading supporting />,
);
