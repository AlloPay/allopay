import { gql } from '@api';
import { useMutation } from 'urql';
import { useQuery } from '~/gql';
import { authContext } from '@api/client';
import { ImageRequireSource, StyleSheet } from 'react-native';
import { Fab } from './Fab';
import { Image } from 'expo-image';
import { useGetGoogleApprover } from '~/util/useGetGoogleApprover';

const Query = gql(/* GraphQL */ `
  query SignInWithGoogleButton {
    user {
      id
      name
      photoUri
      pairingToken
    }
  }
`);

const UpdateUser = gql(/* GraphQL */ `
  mutation SignInWithGoogleButton_UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      name
      photoUri
    }
  }
`);

const Pair = gql(/* GraphQL */ `
  mutation SignInWithGoogleButton_Pair($token: String!) {
    pair(input: { token: $token }) {
      id
      approvers {
        id
      }
    }
  }
`);

const GoogleIconSource: ImageRequireSource = require('assets/google.png');

export interface LinkGoogleButtonProps {
  onLink?: () => void | Promise<void>;
  signOut?: boolean;
}

export function LinkGoogleButton({ onLink, signOut }: LinkGoogleButtonProps) {
  const getApprover = useGetGoogleApprover();
  const updateUser = useMutation(UpdateUser)[1];
  const pair = useMutation(Pair)[1];

  const { user } = useQuery(Query).data;

  if (!getApprover) return null;

  return (
    <Fab
      position="relative"
      icon={(iconProps) => (
        <Image source={GoogleIconSource} style={{ aspectRatio: 1, height: iconProps.size }} />
      )}
      style={styles.container}
      onPress={async () => {
        const r = await getApprover({ signOut });
        if (r.isErr()) return;

        const {
          user: { name, photo },
          approver,
        } = r.value;

        await pair({ token: user.pairingToken }, await authContext(approver));

        if (name || photo) {
          await updateUser({
            input: {
              ...(!user.name && name && { name }),
              ...(!user.photoUri && photo && { photoUri: photo }),
            },
          });
        }

        await onLink?.();
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
  },
});
