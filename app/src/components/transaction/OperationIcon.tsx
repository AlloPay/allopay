import { FragmentType, gql, useFragment } from '@api';
import {
  ActionIcon,
  IconProps,
  PolicyEditOutlineIcon,
  PolicyRemoveOutlineIcon,
  SwapIcon,
  TransferIcon,
} from '@theme/icons';
import { Chain } from 'chains';
import { P, match } from 'ts-pattern';
import { ICON_SIZE } from '@theme/paper';
import { createStyles } from '@theme/styles';
import { View } from 'react-native';
import { FilledIcon } from '#/FilledIcon';
import { AddressIcon } from '#/Identicon/AddressIcon';

const Operation = gql(/* GraphQL */ `
  fragment OperationIcon_Operation on Operation {
    to
    function {
      __typename
      ... on TransferlikeOp {
        to
      }
    }
  }
`);

export interface OperationIconProps extends IconProps {
  operation: FragmentType<typeof Operation>;
  chain: Chain;
}

export function OperationIcon({
  operation: opProp,
  chain,
  size = ICON_SIZE.medium,
  ...iconProps
}: OperationIconProps) {
  const op = useFragment(Operation, opProp);

  const Icon = match(op.function)
    .with({ __typename: 'UpdatePolicyOp' }, () => PolicyEditOutlineIcon)
    .with({ __typename: 'RemovePolicyOp' }, () => PolicyRemoveOutlineIcon)
    .with(
      P.union(
        { __typename: 'TransferOp' },
        { __typename: 'TransferFromOp' },
        { __typename: 'TransferApprovalOp' },
      ),
      (f) => (props: IconProps) => (
        <View>
          <AddressIcon address={f.to} {...props} />
          <FilledIcon icon={TransferIcon} size={(size * 10) / 24} style={styles.overlayed(size)} />
        </View>
      ),
    )
    .with({ __typename: 'SwapOp' }, () => SwapIcon)
    .otherwise(() => (props: IconProps) => (
      <View>
        <AddressIcon address={op.to} {...props} />
        <FilledIcon icon={ActionIcon} size={(size * 10) / 24} style={styles.overlayed(size)} />
      </View>
    ));

  return <Icon size={size} {...iconProps} />;
}

const styles = createStyles({
  overlayed: (size: number) => ({
    position: 'absolute',
    bottom: 0,
    right: 0,
    marginTop: -size,
  }),
});
