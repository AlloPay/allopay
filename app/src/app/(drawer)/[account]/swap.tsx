import { useRouter } from 'expo-router';
import { usePropose } from '@api/usePropose';
import { parseUnits } from 'ethers/lib/utils';
import { Address, FIAT_DECIMALS, fiatToToken } from 'lib';
import { useState } from 'react';
import { InputType, InputsView } from '~/components/InputsView';
import { useSelectedToken } from '~/hooks/useSelectedToken';
import { Divider } from 'react-native-paper';
import { makeStyles } from '@theme/makeStyles';
import { View } from 'react-native';
import { NumericInput } from '~/components/fields/NumericInput';
import { SwapTokens } from '~/components/swap/SwapTokens';
import { getSwapOperations, useSwapPools } from '~/util/swap';
import { DateTime } from 'luxon';
import { Button } from '~/components/Button';
import { gql } from '@api/generated';
import { ETH_ADDRESS } from 'zksync-web3/build/src/utils';
import { useQuery } from '~/gql';
import { AppbarOptions } from '~/components/Appbar/AppbarOptions';
import { z } from 'zod';
import { zAddress } from '~/lib/zod';
import { useLocalParams } from '~/hooks/useLocalParams';
import { withSuspense } from '~/components/skeleton/withSuspense';
import { ScreenSkeleton } from '~/components/skeleton/ScreenSkeleton';
import { ScreenSurface } from '~/components/layout/ScreenSurface';

const Query = gql(/* GraphQL */ `
  query SwapScreen($account: Address!, $from: Address!, $to: Address!, $skipTo: Boolean!) {
    from: token(input: { address: $from }) {
      id
      symbol
      decimals
      price {
        id
        current
      }
      ...InputsView_token @arguments(account: $account)
      ...SwapTokens_fromToken
    }

    to: token(input: { address: $to }) @skip(if: $skipTo) {
      id
      symbol
      ...SwapTokens_toToken
    }

    tokens {
      id
      address
    }
  }
`);

const SwapScreenParams = z.object({ account: zAddress });

function SwapScreen() {
  const { account } = useLocalParams(`/(drawer)/[account]/swap`, SwapScreenParams);
  const styles = useStyles();
  const router = useRouter();
  const propose = usePropose();

  const [fromAddress, setFromAddress] = useState(useSelectedToken());
  const [toAddress, setToAddress] = useState<Address | undefined>();

  const { from, to, tokens } = useQuery(Query, {
    account,
    from: fromAddress,
    to: toAddress || ETH_ADDRESS,
    skipTo: !toAddress,
  }).data;

  const [input, setInput] = useState('');
  const [type, setType] = useState(InputType.Fiat);

  const pools = useSwapPools(
    fromAddress,
    tokens.map((t) => t.address),
  );
  const pool = toAddress && pools.find((p) => p.pair.includes(toAddress));

  if (!from) return null; // TODO: handle

  const fromInput = input || '0';
  const fromAmount =
    type === InputType.Token
      ? parseUnits(fromInput, from.decimals).toBigInt()
      : fiatToToken(parseFloat(fromInput), from.price?.current ?? 0, from.decimals);

  return (
    <>
      <AppbarOptions leading="menu" headline="Swap" />

      <ScreenSurface>
        <InputsView token={from} input={input} setInput={setInput} type={type} setType={setType} />

        <View style={styles.spacer} />

        <SwapTokens
          account={account}
          from={from}
          setFromAddress={setFromAddress}
          fromAmount={fromAmount}
          to={to}
          setToAddress={setToAddress}
          pools={pools}
          pool={pool}
        />

        <Divider horizontalInset />

        <NumericInput
          value={input}
          onChange={setInput}
          maxDecimals={type === InputType.Token ? from.decimals : FIAT_DECIMALS}
        />

        <Button
          mode="contained"
          disabled={!fromAmount || !pool}
          style={styles.action}
          onPress={async () => {
            const proposal = await propose({
              account,
              label: `Swap ${from.symbol} for ${to!.symbol}`,
              operations: await getSwapOperations({
                account,
                pool: pool!,
                from: {
                  token: fromAddress,
                  amount: fromAmount,
                },
                slippage: 0.01, // 1%
                deadline: DateTime.now().plus({ months: 3 }),
              }),
            });
            router.push({ pathname: `/(drawer)/transaction/[hash]/`, params: { hash: proposal } });
          }}
        >
          Propose
        </Button>
      </ScreenSurface>
    </>
  );
}

const useStyles = makeStyles(() => ({
  spacer: {
    flex: 1,
  },
  action: {
    marginHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
}));

export default withSuspense(SwapScreen, ScreenSkeleton);
