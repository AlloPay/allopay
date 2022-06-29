import { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { Headline, Title, useTheme } from 'react-native-paper';
import { Box } from './Box';
import { PRIMARY_ICON_SIZE } from './list/Item';

export interface EmptyListFallbackProps {
  Icon?: ((props: { color: string; size: number }) => ReactNode) | ReactNode;
  title: string;
  subtitle?: string;
}

export const EmptyListFallback = ({
  Icon,
  title,
  subtitle,
}: EmptyListFallbackProps) => {
  const { height } = useWindowDimensions();
  const { colors } = useTheme();

  console.log(typeof Icon)

  return (
    // Set height manually since flex={1} doesn't work within FlexList on Android
    <Box flex={1} height={height}>
      <Box flex={1} />

      <Box flex={2} alignItems="center">
        {typeof Icon === 'function' ? (
          <Icon color={colors.onBackground} size={PRIMARY_ICON_SIZE} />
        ) : (
          Icon
        )}

        <Box my={10}>
          <Headline style={{ textAlign: 'center' }}>{title}</Headline>
        </Box>

        <Title style={{ textAlign: 'center' }}>{subtitle}</Title>
      </Box>

      <Box flex={1} />
    </Box>
  );
};
