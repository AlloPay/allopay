import { Sheet } from '~/components/sheet/Sheet';
import { StackNavigatorScreenProps } from '~/navigation/StackNavigator';
import { materialCommunityIcon } from '@theme/icons';
import { View } from 'react-native';
import { makeStyles } from '@theme/makeStyles';
import { Text } from 'react-native-paper';
import { Button } from '~/components/Button';
import { gql } from '@api/generated';
import { showSuccess } from '~/provider/SnackbarProvider';
import { useMutation } from 'urql';
import { Subject } from 'rxjs';
import { PairConfirmSheet_PairMutation } from '@api/generated/graphql';

export const LINKINGS_FROM_DEVICE = new Subject<PairConfirmSheet_PairMutation>();

const Pair = gql(/* GraphQL */ `
  mutation PairConfirmSheet_Pair($token: String!) {
    pair(input: { token: $token }) {
      id
      approvers {
        id
      }
    }
  }
`);

export const PairIcon = materialCommunityIcon('link-variant');

export interface PairConfirmSheetScreenParams {
  token: string;
}

export type PairConfirmSheetProps = StackNavigatorScreenProps<'PairConfirmSheet'>;

export const PairConfirmSheet = ({ route, navigation: { goBack } }: PairConfirmSheetProps) => {
  const { token } = route.params;
  const styles = useStyles();

  const pair = useMutation(Pair)[1];

  return (
    <Sheet onClose={goBack} handle={false}>
      <View style={styles.infoContainer}>
        <PairIcon style={styles.icon} />

        <Text variant="titleLarge" style={styles.text}>
          Are you sure you want to pair?
        </Text>

        <View>
          <Text variant="titleMedium" style={styles.text}>
            Only pair with your own device
          </Text>

          <Text variant="bodyLarge" style={styles.text}>
            The device will be added to your user, and will be able to do anything on your behalf
            except approve proposals
          </Text>
        </View>

        <Button
          mode="contained"
          icon={PairIcon}
          style={styles.button}
          onPress={async () => {
            const r = await pair({ token });
            if (r.data) LINKINGS_FROM_DEVICE.next(r.data);
            showSuccess('Pairing successful');
            goBack();
          }}
        >
          Pair
        </Button>
      </View>
    </Sheet>
  );
};

const useStyles = makeStyles(({ colors, iconSize }) => ({
  infoContainer: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    gap: 16,
  },
  icon: {
    color: colors.onSurface,
    fontSize: iconSize.large,
  },
  text: {
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.tertiary,
    alignSelf: 'stretch',
  },
}));
