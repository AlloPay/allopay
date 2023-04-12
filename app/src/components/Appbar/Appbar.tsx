import { IconProps } from '@theme/icons';
import { makeStyles } from '@theme/makeStyles';
import { Arraylike, toArray } from 'lib';
import { FC, ReactNode } from 'react';
import { View } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppbarBack2 } from './AppbarBack';
import { AppbarClose } from './AppbarClose';
import { TextProps } from '@theme/types';
import { P, match } from 'ts-pattern';

export interface AppbarProps extends Pick<StyleOptions, 'mode' | 'center'> {
  leading: FC<IconProps> | 'back' | 'close';
  trailing?: Arraylike<FC<IconProps>>;
  headline: ReactNode | FC<Omit<TextProps, 'children'>>;
  elevated?: boolean;
  inset?: boolean;
}

export const Appbar = ({
  mode,
  leading,
  trailing,
  headline: Headline,
  center,
  elevated,
  inset = true,
}: AppbarProps) => {
  const insets = useSafeAreaInsets();
  const styles = useStyles({ mode, center, insets: inset ? insets : undefined });

  const Leading = leading === 'back' ? AppbarBack2 : leading === 'close' ? AppbarClose : leading;

  const HeadlineView = () => (
    <View style={styles.headlineContainer}>
      {typeof Headline === 'function' ? (
        <Headline style={styles.headline} />
      ) : (
        <Text style={styles.headline}>{Headline}</Text>
      )}
    </View>
  );

  return (
    <Surface elevation={elevated ? 2 : 0} style={styles.root}>
      <View style={styles.headerContainer}>
        <View style={styles.leadingContainer}>
          <Leading size={styles.leadingIcon.fontSize} color={styles.leadingIcon.color} />
        </View>

        <View style={{ flex: 1 }}>{mode === 'small' && <HeadlineView />}</View>

        <View style={styles.trailingContainer}>
          {toArray(trailing ?? []).map((Trailing, index) => (
            <Trailing
              key={index}
              size={styles.trailingIcon.fontSize}
              color={styles.trailingIcon.color}
            />
          ))}
        </View>
      </View>

      {mode !== 'small' && <HeadlineView />}
    </Surface>
  );
};

interface StyleOptions {
  mode: 'small' | 'medium' | 'large';
  center?: boolean;
  insets?: EdgeInsets;
}

const useStyles = makeStyles(({ colors, fonts }, { mode, center, insets }: StyleOptions) => ({
  root: {
    display: 'flex',
    justifyContent: match(mode)
      .with('small', () => 'center' as const)
      .with(P.union('medium', 'large'), () => 'space-between' as const)
      .exhaustive(),
    height:
      (insets?.top ?? 0) +
      {
        small: 64,
        medium: 112,
        large: 154,
      }[mode],
    paddingTop:
      (insets?.top ?? 0) +
      match(mode)
        .with('small', () => 0)
        .with(P.union('medium', 'large'), () => 20)
        .exhaustive(),
    paddingBottom: {
      small: 0,
      medium: 24,
      large: 28,
    }[mode],
    paddingHorizontal: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadingContainer: {
    marginRight: 16,
  },
  leadingIcon: {
    color: colors.onSurface,
    fontSize: 24,
  },
  trailingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  trailingIcon: {
    color: colors.onSurfaceVariant,
    fontSize: 24,
  },
  headlineContainer: {
    alignItems: center ? 'center' : 'flex-start',
  },
  headline: {
    ...fonts[
      (
        {
          small: 'titleLarge',
          medium: 'headlineSmall',
          large: 'headlineMedium',
        } as const
      )[mode]
    ],
    color: colors.onSurface,
  },
  supporting: {
    color: colors.onSurfaceVariant,
  },
}));
