import { Text, TextProps } from 'react-native-paper';

import { createStyles, useStyles } from '~/util/theme/styles';

export interface ListItemTrailingTextProps extends Omit<TextProps<'labelSmall'>, 'variant'> {}

export function ListItemTrailingText(props: ListItemTrailingTextProps) {
  const { styles } = useStyles(stylesheet);

  return <Text variant="labelSmall" {...props} style={[styles.text, props.style]} />;
}

const stylesheet = createStyles(({ colors }) => ({
  text: {
    color: colors.onSurfaceVariant,
  },
}));
