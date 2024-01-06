import { asUAddress } from 'lib';
import { useAddressLabel } from '~/components/address/AddressLabel';
import { FiatValue } from '~/components/FiatValue';
import { Timestamp } from '~/components/format/Timestamp';
import { ListItem } from '~/components/list/ListItem';
import { ListItemSkeleton } from '~/components/list/ListItemSkeleton';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { FragmentType, gql, useFragment } from '~/gql/api/generated';
import { TokenIcon } from '../token/TokenIcon';

const FragmentDoc = gql(/* GraphQL */ `
  fragment IncomingTransferItem_TransferFragment on Transfer {
    account {
      id
      chain
    }
    token {
      id
      ...TokenIcon_Token
    }
    from
    timestamp
    value
  }
`);

export interface IncomingTransferItemProps {
  transfer: FragmentType<typeof FragmentDoc>;
}

function IncomingTransferItem_(props: IncomingTransferItemProps) {
  const transfer = useFragment(FragmentDoc, props.transfer);

  return (
    <ListItem
      leading={(props) => <TokenIcon token={transfer.token} {...props} />}
      leadingSize="medium"
      headline={`Transfer from ${useAddressLabel(
        asUAddress(transfer.from, transfer.account.chain),
      )}`}
      supporting={<Timestamp timestamp={transfer.timestamp} weekday />}
      trailing={({ Text }) =>
        transfer.value !== null && transfer.value !== undefined ? (
          <Text variant="labelLarge">
            <FiatValue value={transfer.value} />
          </Text>
        ) : null
      }
    />
  );
}

export const IncomingTransferItem = withSuspense(
  IncomingTransferItem_,
  <ListItemSkeleton leading supporting />,
);
