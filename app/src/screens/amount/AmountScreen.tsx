import { AppbarBack } from '~/components/Appbar/AppbarBack';
import { Box } from '~/components/layout/Box';
import { CheckIcon, CloseIcon } from '~/util/theme/icons';
import { BigNumber } from 'ethers';
import { ZERO } from 'lib';
import { useCallback, useMemo, useState } from 'react';
import { Appbar } from 'react-native-paper';
import { FAB } from '~/components/FAB';
import { SelectedTokenCard } from '~/components/token/SelectedTokenCard';
import { useSelectedToken } from '~/components/token/useSelectedToken';
import { RootNavigatorScreenProps } from '~/navigation/RootNavigator';
import { convertTokenAmount, Token } from '@token/token';
import { AmountInput } from './AmountInput';

export interface AmountScreenParams {
  onChange: (amount?: BigNumber) => void;
}

export type AmountScreenProps = RootNavigatorScreenProps<'Amount'>;

export const AmountScreen = ({ navigation, route }: AmountScreenProps) => {
  const { onChange } = route.params;

  const [amount, setAmount] = useState<BigNumber | undefined>();

  const clear = useCallback(() => {
    onChange(undefined);
    navigation.goBack();
  }, [navigation, onChange]);

  const accept = useCallback(() => {
    onChange(amount);
    navigation.goBack();
  }, [amount, navigation, onChange]);

  const token = useSelectedToken();
  const [prevToken, setPrevToken] = useState<Token>(token);
  useMemo(() => {
    if (prevToken !== token && amount) {
      setAmount(convertTokenAmount(amount, prevToken, token));
      setPrevToken(token);
    }
  }, [amount, prevToken, setAmount, token]);

  return (
    <Box flex={1}>
      <Appbar.Header>
        <AppbarBack />
        <Appbar.Content title="Amount" />
        <Appbar.Action icon={CloseIcon} onPress={clear} />
      </Appbar.Header>

      <Box mx={3}>
        <Box mt={5} mb={6}>
          <SelectedTokenCard />
        </Box>

        <AmountInput amount={amount} setAmount={setAmount} />
      </Box>

      <FAB
        icon={CheckIcon}
        label="Accept"
        disabled={!amount || amount.eq(ZERO)}
        onPress={accept}
      />
    </Box>
  );
};
