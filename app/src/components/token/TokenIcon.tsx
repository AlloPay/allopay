import { FragmentType, gql, useFragment as getFragment } from '@api/generated';
import { materialCommunityIcon } from '@theme/icons';
import { createStyles, useStyles } from '@theme/styles';
import { Image, ImageProps } from 'expo-image';
import { UAddress, isUAddress } from 'lib';
import { ImageStyle, StyleProp } from 'react-native';
import { CircleSkeleton } from '~/components/skeleton/CircleSkeleton';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { useQuery } from '~/gql';

export const ETH_ICON_URI =
  'https://cloudfront-us-east-1.images.arcpublishing.com/coindesk/ZJZZK5B2ZNF25LYQHMUTBTOMLU.png';
Image.prefetch(ETH_ICON_URI);

export const UnknownTokenIcon = materialCommunityIcon('help-circle-outline');

const Query = gql(/* GraphQL */ `
  query TokenIcon($token: UAddress!) {
    token(input: { address: $token }) {
      ...TokenIcon_Token
    }
  }
`);

const Token = gql(/* GraphQL */ `
  fragment TokenIcon_Token on Token {
    id
    iconUri
  }
`);

export interface TokenIconProps extends Omit<ImageProps, 'source' | 'style'> {
  token: FragmentType<typeof Token> | UAddress | null | undefined;
  fallbackUri?: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

function TokenIcon_({
  token: tokenFragment,
  fallbackUri,
  size,
  style,
  ...imageProps
}: TokenIconProps) {
  const { styles } = useStyles(stylesheet);

  const query = useQuery(
    Query,
    { token: isUAddress(tokenFragment) ? tokenFragment : 'zksync:0x' },
    { pause: !isUAddress(tokenFragment) },
  ).data;

  const iconUri =
    getFragment(Token, !isUAddress(tokenFragment) ? tokenFragment : query?.token)?.iconUri ??
    fallbackUri;

  if (!iconUri)
    return <UnknownTokenIcon {...imageProps} size={size} style={[style, styles.icon(size)]} />;

  return (
    <Image
      {...imageProps}
      source={{ uri: iconUri }}
      style={[style, styles.icon(size)].filter(Boolean)}
    />
  );
}

const stylesheet = createStyles(({ iconSize }) => ({
  icon: (size: number = iconSize.medium) => ({
    width: size,
    height: size,
    backgroundColor: undefined,
  }),
}));

export const TokenIcon = withSuspense(TokenIcon_, ({ size }) => <CircleSkeleton size={size} />);
