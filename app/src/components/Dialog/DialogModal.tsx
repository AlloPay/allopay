import { ScaledSize, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Dialog, DialogProps } from 'react-native-paper';

import { createStyles } from '~/util/theme/styles';

export interface DialogModalProps extends Omit<DialogProps, 'visible' | 'onDismiss'> {}

export function DialogModal(props: DialogModalProps) {
  return (
    <Dialog
      visible
      onDismiss={useRouter().back}
      {...props}
      style={[styles.dialog(useWindowDimensions()), props.style]}
    />
  );
}

// https://m3.material.io/components/dialogs/specs
const styles = createStyles({
  dialog: (window: ScaledSize) => ({
    alignSelf: 'center',
    minWidth: Math.min(window.width, 280),
    maxWidth: 560,
  }),
});
