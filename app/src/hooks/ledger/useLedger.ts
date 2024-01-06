import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { err } from 'neverthrow';
import { DeviceId } from 'react-native-ble-plx';

import { Address } from 'lib';
import { FragmentType, useFragment as getFragment, gql } from '~/gql/api/generated';
import useBluetoothPermissions from '~/hooks/ble/useBluetoothPermissions';
import { useObservable } from '~/hooks/useObservable';
import { persistedAtom } from '~/lib/persistedAtom';
import { connectLedger } from './connectLedger';

const UserApprover = gql(/* GraphQL */ `
  fragment UseLedger_UserApprover on UserApprover {
    id
    address
    bluetoothDevices
  }
`);

export const APPROVER_BLE_IDS = persistedAtom<Record<Address, DeviceId[]>>('approverBleIds', {});

export function useLedger(device: DeviceId | FragmentType<typeof UserApprover>) {
  const [hasPermission, requestPermissions] = useBluetoothPermissions();

  const approver = typeof device !== 'string' ? getFragment(UserApprover, device) : undefined;
  const approverBleIds = useAtomValue(APPROVER_BLE_IDS);

  const result =
    useObservable(
      useMemo(() => {
        if (!hasPermission) return null;

        const deviceIds = approver
          ? [...(approverBleIds[approver.address] ?? []), ...(approver?.bluetoothDevices ?? [])]
          : [device as string];

        return connectLedger(deviceIds);
      }, [hasPermission, approver, approverBleIds, device]),
    ) ?? err('finding' as const);

  return hasPermission
    ? result
    : err({ type: 'permissions-required' as const, requestPermissions });
}
