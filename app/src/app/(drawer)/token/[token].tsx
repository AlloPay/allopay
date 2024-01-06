import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { Menu } from 'react-native-paper';
import { useMutation } from 'urql';
import { z } from 'zod';

import {
  asAddress,
  asChain,
  asUAddress,
  isAddressLike,
  tryAsUAddress,
  tryOrIgnore,
  UAddress,
} from 'lib';
import { AppbarMore } from '~/components/Appbar/AppbarMore';
import { AppbarOptions } from '~/components/Appbar/AppbarOptions';
import { FormSelectChip } from '~/components/fields/FormSelectChip';
import { FormSubmitButton } from '~/components/fields/FormSubmitButton';
import { FormTextField } from '~/components/fields/FormTextField';
import { Indented } from '~/components/fields/Indented';
import { AddressIcon } from '~/components/Identicon/AddressIcon';
import { Actions } from '~/components/layout/Actions';
import { ScreenSurface } from '~/components/layout/ScreenSurface';
import { ScreenSkeleton } from '~/components/skeleton/ScreenSkeleton';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { UnknownTokenIcon } from '~/components/token/TokenIcon';
import { useQuery } from '~/gql';
import { gql } from '~/gql/api/generated';
import { useConfirmRemoval } from '~/hooks/useConfirm';
import { useLocalParams } from '~/hooks/useLocalParams';
import { useSelectedChain } from '~/hooks/useSelectedAccount';
import { SUPPORTED_CHAINS } from '~/lib/network/chains';
import { zAddress, zChain, zUAddress } from '~/lib/zod';
import { ADDRESS_FIELD_RULES } from '~/util/form.rules';
import { ChainIcon } from '~/util/theme/icons';

const Query = gql(/* GraphQL */ `
  query TokenScreen($token: UAddress!) {
    token(input: { address: $token }) {
      id
      address
      userOwned
      name
      symbol
      decimals
      iconUri
    }

    metadata: tokenMetadata(input: { address: $token }) {
      id
      name
      symbol
      decimals
      iconUri
    }
  }
`);

const UpsertToken = gql(/* GraphQL */ `
  mutation TokenScreenUpsert($input: UpsertTokenInput!) {
    upsertToken(input: $input) {
      id
      name
      symbol
      decimals
      iconUri
    }
  }
`);

const RemoveToken = gql(/* GraphQL */ `
  mutation TokenScreenRemoval($token: UAddress!) {
    removeToken(input: { address: $token })
  }
`);

const chainEntries = Object.values(SUPPORTED_CHAINS).map((c) => [c.name, c.key] as const);

const scheme = z.object({
  address: zAddress(),
  chain: zChain(),
  // TODO: add pythUsdPriceId
  name: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.number().min(0),
  iconUri: z.union([z.string().trim().url().optional(), z.null()]),
});

export interface TokenScreenProps {
  token?: UAddress;
}

function SharedTokenScreen_(props: TokenScreenProps) {
  const router = useRouter();
  const upsert = useMutation(UpsertToken)[1];
  const remove = useMutation(RemoveToken)[1];
  const confirmRemoval = useConfirmRemoval({
    message: 'Are you sure you want to remove this token?',
  });
  const selectedChain = useSelectedChain();

  const { control, handleSubmit, watch, reset } = useForm<z.infer<typeof scheme>>({
    resolver: zodResolver(scheme),
    defaultValues: {
      address: asAddress(props.token),
      chain: props.token ? asChain(props.token) : selectedChain,
    },
  });
  const [address, chain, iconUri] = watch(['address', 'chain', 'iconUri']);
  const iconUriValid = !!tryOrIgnore(() => iconUri && new URL(iconUri));

  const uaddress = chain && tryAsUAddress(address, chain);
  const query = useQuery(
    Query,
    { token: uaddress! },
    {
      pause: !uaddress,
      context: useMemo(() => ({ suspense: false }), []),
    },
  ).data;

  useEffect(() => {
    const m = query?.token ?? query?.metadata;
    if (address && isAddressLike(address) && m) {
      reset((t) => ({
        address: t.address!,
        chain: t.chain!,
        name: t.name || m.name!,
        symbol: t.symbol || m.symbol!,
        decimals: t.decimals || m.decimals!,
        iconUri: t.iconUri || m.iconUri!,
      }));
    }
  }, [reset, address, query?.metadata, query?.token]);

  return (
    <>
      <AppbarOptions
        headline="Tokens"
        trailing={
          query?.token?.userOwned
            ? (props) => (
                <AppbarMore iconProps={props}>
                  {({ close }) => (
                    <Menu.Item
                      title="Remove token"
                      onPress={async () => {
                        close();
                        if (
                          await confirmRemoval({
                            message: 'Are you sure you want to remove this token?',
                          })
                        ) {
                          await remove({ token: query.token!.address });
                          router.back();
                        }
                      }}
                    />
                  )}
                </AppbarMore>
              )
            : undefined
        }
      />

      <ScreenSurface>
        <ScrollView contentContainerStyle={styles.container}>
          <Indented
            leading={
              isAddressLike(address)
                ? (props) => <AddressIcon address={asAddress(address)} {...props} />
                : undefined
            }
          >
            <FormTextField
              label="Address"
              name="address"
              placeholder="0x..."
              multiline
              control={control}
              rules={{
                ...ADDRESS_FIELD_RULES,
                required: true,
              }}
              containerStyle={styles.field}
            />
          </Indented>

          <View style={styles.chainFieldContainer}>
            <FormSelectChip
              name="chain"
              control={control}
              entries={chainEntries}
              chipProps={{ icon: ChainIcon }}
            />
          </View>

          <Indented>
            <FormTextField
              label="Name"
              name="name"
              placeholder="USD Coin"
              required
              control={control}
              containerStyle={styles.field}
            />
          </Indented>

          <Indented>
            <FormTextField
              label="Symbol"
              name="symbol"
              placeholder="USDC"
              required
              control={control}
              containerStyle={styles.field}
            />
          </Indented>

          <Indented>
            <FormTextField
              label="Decimals"
              name="decimals"
              placeholder="6"
              required
              control={control}
              containerStyle={styles.field}
              inputMode="numeric"
            />
          </Indented>

          <Indented
            leading={
              iconUri && iconUriValid
                ? ({ size }) => (
                    <Image source={[{ uri: iconUri }]} style={{ width: size, height: size }} />
                  )
                : UnknownTokenIcon
            }
          >
            <FormTextField
              label="Icon URL"
              name="iconUri"
              multiline
              control={control}
              containerStyle={styles.field}
            />
          </Indented>

          <Actions>
            <FormSubmitButton
              mode="contained"
              // requireChanges
              control={control}
              onPress={handleSubmit(async ({ address, chain, name, symbol, decimals, iconUri }) => {
                await upsert({
                  input: {
                    address: asUAddress(address, chain),
                    name,
                    symbol,
                    decimals: parseFloat(`${decimals}`),
                    iconUri,
                  },
                });
              })}
            >
              Save
            </FormSubmitButton>
          </Actions>
        </ScrollView>
      </ScreenSurface>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    marginTop: 16,
    marginHorizontal: 16,
    gap: 16,
  },
  field: {
    flex: 1,
  },
  chainFieldContainer: {
    alignItems: 'flex-end',
  },
});

export const SharedTokenScreen = withSuspense(SharedTokenScreen_, <ScreenSkeleton />);

const TokenScreenParams = z.object({ token: zUAddress() });

export default function TokenScreen() {
  const { token } = useLocalParams(TokenScreenParams);
  return <SharedTokenScreen token={token} />;
}
