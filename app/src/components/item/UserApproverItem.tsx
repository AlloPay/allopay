import { FragmentType, gql, useFragment } from '@api/generated';
import { useApproverAddress } from '@network/useApprover';
import { useRouter } from 'expo-router';
import { RadioButton } from 'react-native-paper';
import { ListItem, ListItemProps } from '~/components/list/ListItem';
import { truncateAddr } from '~/util/format';

const UserApprover = gql(/* GraphQL */ `
  fragment UserApproverItem_UserApprover on UserApprover {
    id
    address
    name
    cloud {
      id
      provider
      subject
    }
  }
`);

export interface UserApproverItemProps extends Partial<ListItemProps> {
  approver: FragmentType<typeof UserApprover>;
}

export function UserApproverItem(props: UserApproverItemProps) {
  const a = useFragment(UserApprover, props.approver);
  const router = useRouter();
  const selected = useApproverAddress() === a.address;

  return (
    <ListItem
      leading={a.address}
      headline={a.name}
      supporting={truncateAddr(a.address)}
      {...(selected && { trailing: 'This device' })}
      onPress={() =>
        router.push({ pathname: `/(drawer)/approvers/[address]/`, params: { address: a.address } })
      }
      {...props}
    />
  );
}
