import { FC, ReactNode, forwardRef } from 'react';
import { IconProps } from '@theme/icons';
import { Text } from 'react-native-paper';
import { TextProps } from '@theme/types';
import { PressableProps, StyleProp, TextStyle, View, ViewStyle } from 'react-native';
import { O } from 'ts-toolbelt';
import { ICON_SIZE } from '@theme/paper';
import { createStyles, useStyles } from '@theme/styles';
import { PressableOpacity } from '#/PressableOpacity';

/*
 * https://m3.material.io/components/lists/specs
 */

type Lines = 1 | 2 | 3;

export interface ListIconElementProps extends IconProps {}

export interface ListItemTextProps {
  Text: FC<TextProps>;
}

export type ListItemProps = Pick<PressableProps, 'onPress' | 'onLongPress'> &
  O.Optional<StyleProps, 'lines' | 'leadingSize' | 'variant'> & {
    leading?: ReactNode | FC<ListIconElementProps>;
    overline?: ReactNode | FC<ListItemTextProps>;
    headline: ReactNode | FC<ListItemTextProps>;
    supporting?: ReactNode | FC<ListItemTextProps>;
    trailing?: FC<ListIconElementProps & ListItemTextProps> | ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    selected?: boolean;
  };

export const ListItem = forwardRef<View, ListItemProps>(
  (
    {
      leading: Leading,
      leadingSize = typeof Leading === 'string' ? 'medium' : 'small',
      overline: Overline,
      headline: Headline,
      supporting: Supporting,
      trailing: Trailing,
      lines = (1 + Number(!!Overline) + Number(!!Supporting)) as Lines,
      selected,
      disabled,
      containerStyle,
      textStyle,
      variant = 'flat',
      ...touchableProps
    },
    ref,
  ) => {
    const { styles } = useStyles(getStylesheet({ lines, leadingSize, disabled, variant }));

    const OverlineText = ({ style, ...props }: TextProps) => (
      <Text
        variant="labelSmall"
        numberOfLines={1}
        {...props}
        style={[styles.overline, textStyle, style]}
      />
    );
    const HeadlineText = ({ style, ...props }: TextProps) => (
      <Text
        variant="bodyLarge"
        numberOfLines={1}
        {...props}
        style={[styles.headline, textStyle, style]}
      />
    );
    const SupportingText = ({ style, ...props }: TextProps) => (
      <Text
        variant="bodyMedium"
        {...props}
        style={[styles.supporting, textStyle, style]}
        numberOfLines={Math.max(lines - 1, 1)}
      />
    );
    const TrailingText = ({ style, ...props }: TextProps) => (
      <Text variant="labelSmall" {...props} style={[styles.trailingText, textStyle, style]} />
    );

    return (
      <PressableOpacity
        ref={ref}
        {...touchableProps}
        style={[styles.container, containerStyle]}
        disabled={disabled}
        selected={selected}
      >
        <>
          {Leading && (
            <View style={styles.leadingContainer}>
              {isFunctionalComponent(Leading) ? (
                <Leading
                  size={styles.leadingIcon.fontSize}
                  color={styles.leadingIcon.backgroundColor}
                />
              ) : (
                <>{Leading}</>
              )}
            </View>
          )}

          <View style={styles.mainContainer}>
            {Overline &&
              (typeof Overline === 'function' ? (
                <Overline Text={OverlineText} />
              ) : (
                <OverlineText>{Overline}</OverlineText>
              ))}

            {typeof Headline === 'function' ? (
              <Headline Text={HeadlineText} />
            ) : (
              <HeadlineText>{Headline}</HeadlineText>
            )}

            {Supporting &&
              (typeof Supporting === 'function' ? (
                <Supporting Text={SupportingText} />
              ) : (
                <SupportingText>{Supporting}</SupportingText>
              ))}
          </View>

          {Trailing && (
            <View style={styles.trailingContainer}>
              {typeof Trailing === 'function' ? (
                <Trailing
                  size={styles.trailingIcon.fontSize}
                  color={styles.trailingIcon.color}
                  Text={TrailingText}
                />
              ) : (
                <TrailingText>{Trailing}</TrailingText>
              )}
            </View>
          )}
        </>
      </PressableOpacity>
    );
  },
);

interface StyleProps {
  lines: Lines;
  disabled?: boolean;
  leadingSize: 'small' | 'medium';
  variant: 'flat' | 'surface';
}

export enum ListItemHeight {
  SINGLE_LINE = 56,
  DOUBLE_LINE = 72,
  TRIPLE_LINE = 88,
}

const getStylesheet = ({ lines, disabled, leadingSize, variant }: StyleProps) =>
  createStyles(({ colors, corner, stateLayer }) => {
    const justifyContent = lines === 3 ? 'flex-start' : 'center';

    const withState = (color: string) => color;

    return {
      container: {
        flexDirection: 'row',
        minHeight: [
          ListItemHeight.SINGLE_LINE,
          ListItemHeight.DOUBLE_LINE,
          ListItemHeight.TRIPLE_LINE,
        ][lines - 1],
        paddingLeft: 16,
        paddingRight: 24,
        paddingVertical: lines === 3 ? 12 : 8,
        ...(variant === 'surface' && { backgroundColor: colors.surface }),
        // Ideally 'box-none' but this breaks pressable children without pointerEvents: 'auto'
        // ...(!pressable && { pointerEvents: 'box-none' }),
        ...(disabled && { opacity: 0.5 }),
      },
      leadingContainer: {
        justifyContent,
        marginRight: 16,
      },
      leadingAvatarContainer: {
        backgroundColor: withState(colors.tertiaryContainer),
        borderRadius: corner.full,
      },
      leadingAvatarLabel: {
        color: withState(colors.tertiary),
      },
      leadingIcon: {
        fontSize: ICON_SIZE[leadingSize],
        backgroundColor: withState(colors.onSurfaceVariant),
      },
      mainContainer: {
        flex: 1,
        justifyContent,
      },
      overline: {
        color: withState(colors.onSurfaceVariant),
      },
      headline: {
        color: withState(colors.onSurface),
      },
      supporting: {
        color: withState(colors.onSurfaceVariant),
      },
      trailingContainer: {
        justifyContent,
        alignItems: 'flex-end',
        marginLeft: 16,
      },
      trailingText: {
        color: withState(colors.onSurfaceVariant),
        textAlign: 'right',
      },
      trailingIcon: {
        fontSize: 24,
        color: withState(colors.onSurface),
      },
    };
  });

function isFunctionalComponent(c: unknown): c is FC<any> {
  return (
    typeof c === 'function' ||
    (typeof c === 'object' &&
      c !== null &&
      (c as any)?.$$typeof === Symbol.for('react.forward_ref'))
  );
}
