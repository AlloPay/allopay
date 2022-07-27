import { useMemo, useState } from 'react';
import { Image } from 'react-native';
import { LabelIcon } from '@components/LabelIcon';

import { Token } from '~/token/token';
import { SvgUri } from '@components/SvgUri';
import { useTheme } from '@util/theme/paper';

export interface TokenIconProps {
  token: Token;
  size?: number;
}

export const TokenIcon = ({
  token: { iconUri, symbol },
  size,
}: TokenIconProps) => {
  const { iconSize } = useTheme();

  const [fallback, setFallback] = useState(false);
  const handleError = () => setFallback(true);

  const dimensions = useMemo(
    () => ({
      width: size ?? iconSize.medium,
      height: size ?? iconSize.medium,
    }),
    [iconSize.medium, size],
  );

  if (fallback) return <LabelIcon label={symbol} />;

  if (iconUri.toLowerCase().endsWith('.svg'))
    return <SvgUri uri={iconUri} {...dimensions} onError={handleError} />;

  return (
    <Image
      source={{ uri: iconUri }}
      style={dimensions}
      resizeMode="contain"
      onError={handleError}
    />
  );
};
