import { gql } from '@api/gen';
import { TokenScreenQuery, TokenScreenQueryVariables } from '@api/gen/graphql';
import { TokenScreenDocument, useTokenScreenUpsertMutation } from '@api/generated';
import { useQuery } from '@apollo/client';
import { Image } from 'expo-image';
import { Address, asAddress, isAddressLike } from 'lib';
import _ from 'lodash';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollView, StyleSheet } from 'react-native';
import { Appbar } from '~/components/Appbar/Appbar';
import { AddressIcon } from '~/components/Identicon/AddressIcon';
import { FormSubmitButton } from '~/components/fields/FormSubmitButton';
import { FormTextField } from '~/components/fields/FormTextField';
import { Indented } from '~/components/fields/Indented';
import { Actions } from '~/components/layout/Actions';
import { Screen } from '~/components/layout/Screen';
import { ScreenSkeleton } from '~/components/skeleton/ScreenSkeleton';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { UnknownTokenIcon } from '~/components/token/TokenIcon/TokenIcon';
import { StackNavigatorScreenProps } from '~/navigation/StackNavigator';
import { ADDRESS_FIELD_RULES } from '~/util/form.rules';

gql(/* GraphQL */ `
  query TokenScreen($token: Address!) {
    metadata: tokenMetadata(input: { address: $token }) {
      id
      ethereumAddress
      name
      symbol
      decimals
      iconUri
    }
  }

  mutation TokenScreenUpsert($input: UpsertTokenInput!) {
    upsertToken(input: $input) {
      id
    }
  }
`);

interface Inputs {
  address: Address;
  ethereumAddress?: Address;
  name: string;
  symbol: string;
  decimals: number;
  iconUri?: string;
}

export interface TokenScreenParams {
  token?: Address;
}

export type TokenScreenProps = StackNavigatorScreenProps<'Token'>;

export const TokenScreen = withSuspense(({ route: { params } }: TokenScreenProps) => {
  const [upsert] = useTokenScreenUpsertMutation();
  const { control, handleSubmit, watch, reset } = useForm<Inputs>({
    defaultValues: { address: params.token },
  });
  const [address, ethereumAddress, iconUri] = watch(['address', 'ethereumAddress', 'iconUri']);

  const m = useQuery<TokenScreenQuery, TokenScreenQueryVariables>(TokenScreenDocument, {
    variables: { token: address as Address },
    skip: !address || !isAddressLike(address),
  }).data?.metadata;

  useEffect(() => {
    if (address && isAddressLike(address) && m) {
      reset({
        ...Object.fromEntries(
          Object.entries(_.omit(m, ['__typename', 'id'])).filter(
            (_, v) => v !== null && v !== undefined,
          ),
        ),
        address,
        ...(typeof m.decimals === 'number' && { decimals: `${m.decimals}` as unknown as number }), // Only works if reset as string, even though input type is number
      });
    }
  }, [reset, m, address]);

  const [isValidIcon, setValidIcon] = useState(false);

  return (
    <Screen>
      <Appbar mode="small" headline="Tokens" />

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

        <Indented
          leading={
            isAddressLike(ethereumAddress)
              ? (props) => <AddressIcon address={asAddress(ethereumAddress)} {...props} />
              : undefined
          }
        >
          <FormTextField
            label="Ethereum address"
            name="ethereumAddress"
            placeholder="0x..."
            multiline
            control={control}
            containerStyle={styles.field}
          />
        </Indented>

        <Indented>
          <FormTextField
            label="Name"
            name="name"
            placeholder="USD Coin"
            rules={{ required: true }}
            control={control}
            containerStyle={styles.field}
          />
        </Indented>

        <Indented>
          <FormTextField
            label="Symbol"
            name="symbol"
            placeholder="USDC"
            rules={{ required: true }}
            control={control}
            containerStyle={styles.field}
          />
        </Indented>

        <Indented>
          <FormTextField
            label="Decimals"
            name="decimals"
            placeholder="6"
            rules={{ required: true }}
            control={control}
            containerStyle={styles.field}
            inputMode="numeric"
          />
        </Indented>

        <Indented
          leading={
            iconUri
              ? (props) => (
                  <Image
                    source={[{ uri: iconUri }]}
                    onError={() => setValidIcon(false)}
                    onLoad={() => setValidIcon(true)}
                    style={{ width: props.size, height: props.size }}
                  />
                )
              : UnknownTokenIcon
          }
        >
          <FormTextField
            label="Icon URL"
            name="iconUri"
            multiline
            rules={{
              pattern: {
                value: /https?:\/\//,
                message: 'Must start with https or http',
              },
              validate: (v) => !v || isValidIcon || 'Invalid',
            }}
            control={control}
            containerStyle={styles.field}
          />
        </Indented>

        <Actions>
          <FormSubmitButton
            mode="contained"
            control={control}
            onPress={handleSubmit(async (input) => {
              await upsert({
                variables: {
                  input: { ...input, decimals: parseFloat(input.decimals as unknown as string) },
                },
              });
            })}
          >
            Save
          </FormSubmitButton>
        </Actions>
      </ScrollView>
    </Screen>
  );
}, ScreenSkeleton);

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    marginTop: 8,
    marginHorizontal: 16,
    gap: 8,
  },
  field: {
    flex: 1,
  },
});
