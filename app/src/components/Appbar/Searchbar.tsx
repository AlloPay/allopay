import { FC } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Surface } from 'react-native-paper';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

import { toArray } from 'lib';
import { IconProps, SearchIcon } from '~/util/theme/icons';
import { createStyles, useStyles } from '~/util/theme/styles';
import { BasicTextField, BasicTextFieldProps } from '../fields/BasicTextField';

export interface SearchbarProps extends BasicTextFieldProps {
  leading?: FC<IconProps & { style?: StyleProp<ViewStyle> }>;
  trailing?: FC<IconProps> | FC<IconProps>[];
  placeholder?: string;
  inset?: boolean;
}

export function Searchbar({
  leading: Leading = SearchIcon,
  trailing,
  inset = true,
  ...inputProps
}: SearchbarProps) {
  const { styles } = useStyles(stylesheet);
  const insets = useSafeAreaInsets();

  return (
    <Surface elevation={3} style={styles.container(inset ? insets : undefined)}>
      <View style={styles.leadingContainer}>
        {Leading && <Leading size={styles.leadingIcon.fontSize} color={styles.leadingIcon.color} />}
      </View>

      <BasicTextField {...inputProps} style={[styles.input, inputProps.style]} />

      <View style={styles.trailingContainer}>
        {toArray(trailing ?? []).map((Trailing, i) => (
          <Trailing key={i} size={styles.trailingIcon.fontSize} color={styles.trailingIcon.color} />
        ))}
      </View>
    </Surface>
  );
}

const stylesheet = createStyles(({ colors, corner, fonts }) => ({
  // https://m3.material.io/components/search/specs
  container: (insets?: EdgeInsets) => ({
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    // minWidth: 360, // In the m3 spec, but breaks on smaller screens
    maxWidth: 720,
    borderRadius: corner.full,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16 + (insets?.top ?? 0),
    marginBottom: 8,
  }),
  leadingContainer: {
    paddingRight: 16,
  },
  leadingIcon: {
    fontSize: 24,
    color: colors.onSurface,
  },
  input: {
    flex: 1,
    ...fonts.bodyLarge,
  },
  inputPlaceholder: {
    color: colors.onSurfaceVariant,
  },
  trailingContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  trailingIcon: {
    fontSize: 24,
    color: colors.onSurfaceVariant,
  },
}));
