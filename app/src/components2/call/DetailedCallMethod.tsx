import { Box } from '@components/Box';
import { ExpandableText } from '@components/ExpandableText';
import { Container } from '@components/list/Container';
import { getMethodInputs } from '@util/getMethodInputs';
import { hexlify } from 'ethers/lib/utils';
import { Call } from 'lib';
import { useMemo } from 'react';
import { Text } from 'react-native-paper';
import { useContractMethod } from '~/queries/useContractMethod.api';
import { MethodInputRow } from './MethodInputRow';

export interface DetailedCallMethodProps {
  call: Call;
}

export const DetailedCallMethod = ({ call }: DetailedCallMethodProps) => {
  const { methodFragment, contractInterface } = useContractMethod(
    call.to,
    call.data,
  );
  const inputs = useMemo(
    () =>
      methodFragment && contractInterface
        ? getMethodInputs({
            contractInterface,
            fragment: methodFragment,
            data: call.data,
          })
        : [],
    [call.data, contractInterface, methodFragment],
  );

  if (!methodFragment)
    return (
      <Box>
        <Text variant="titleMedium">Data</Text>

        <ExpandableText value={hexlify(call.data)} beginLen={18}>
          {({ value }) => <Text variant="bodySmall">{value}</Text>}
        </ExpandableText>
      </Box>
    );

  return (
    <Container separator={<Box mt={1} />}>
      <Text variant="titleMedium">{methodFragment.name}</Text>

      {inputs.map((input) => (
        <Box key={input.param.format()} ml={2}>
          <MethodInputRow key={input.param.format()} {...input} />
        </Box>
      ))}
    </Container>
  );
};
