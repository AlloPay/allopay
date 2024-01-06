import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Collapsible from 'react-native-collapsible';
import { Divider, Text } from 'react-native-paper';

import { Address, asAddress, asChain, asUAddress } from 'lib';
import { Chevron } from '~/components/Chevron';
import { ListItem, ListItemHeight } from '~/components/list/ListItem';
import { ListItemHorizontalTrailing } from '~/components/list/ListItemHorizontalTrailing';
import { ListItemTrailingText } from '~/components/list/ListItemTrailingText';
import { ApproverItem } from '~/components/policy/ApproverItem';
import { ThresholdChip } from '~/components/policy/ThresholdChip';
import { showInfo } from '~/components/provider/SnackbarProvider';
import { useSelectAddress } from '~/hooks/useSelectAddress';
import { useToggle } from '~/hooks/useToggle';
import { usePolicyDraftState } from '~/lib/policy/draft';
import { AddIcon, ContactsIcon } from '~/util/theme/icons';
import { createStyles, useStyles } from '~/util/theme/styles';

export interface ApprovalSettingsProps {
  initiallyExpanded: boolean;
}

export function ApprovalSettings(props: ApprovalSettingsProps) {
  const { styles } = useStyles(stylesheet);
  const selectAddress = useSelectAddress();

  const [policy, update] = usePolicyDraftState();
  const [expanded, toggleExpanded] = useToggle(props.initiallyExpanded);

  const addApprover = async () => {
    const address = await selectAddress({
      include: ['approvers', 'contacts'],
      disabled: [...policy.approvers],
    });
    if (address) {
      update((draft) => {
        draft.approvers.add(asAddress(address));
        draft.threshold++;
      });
    }
  };

  const remove = (approver: Address) => {
    const originalThreshold = policy.threshold;

    update((draft) => {
      draft.approvers.delete(approver);
      draft.threshold = Math.max(policy.threshold, policy.approvers.size);
    });

    showInfo('Approver removed', {
      action: {
        label: 'Undo',
        onPress: () =>
          update((draft) => {
            draft.approvers.add(approver);
            draft.threshold = originalThreshold;
          }),
      },
    });
  };

  return (
    <>
      <ListItem
        leading={ContactsIcon}
        headline="Approvals"
        trailing={(props) => (
          <ListItemHorizontalTrailing>
            <ListItemTrailingText>{`${policy.threshold}/${policy.approvers.size} required`}</ListItemTrailingText>
            <Chevron expanded={expanded} {...props} />
          </ListItemHorizontalTrailing>
        )}
        onPress={toggleExpanded}
      />
      <Collapsible collapsed={!expanded}>
        <View style={styles.thresholdContainer}>
          <ThresholdChip />
        </View>

        <FlashList
          data={[...policy.approvers]}
          renderItem={({ item }) => (
            <ApproverItem
              address={asUAddress(item, asChain(policy.account))}
              remove={() => remove(item)}
            />
          )}
          ListEmptyComponent={
            <Text variant="titleMedium" style={styles.noApproversText}>
              No approvals are required - literally anyone may execute a transaction using this
              policy. Make sure this is intended!
            </Text>
          }
          keyExtractor={(item) => item}
          estimatedItemSize={ListItemHeight.SINGLE_LINE}
        />
        <ListItem leading={AddIcon} headline="Add approver" onPress={addApprover} />
      </Collapsible>
      <Divider leftInset style={styles.divider} />
    </>
  );
}

const stylesheet = createStyles(({ colors }) => ({
  thresholdContainer: {
    flexDirection: 'row',
    marginLeft: 16,
    marginRight: 24,
    marginBottom: 8,
  },
  noApproversText: {
    textAlign: 'center',
    marginVertical: 8,
    marginHorizontal: 16,
    color: colors.warning,
  },
  divider: {
    marginVertical: 8,
  },
}));
