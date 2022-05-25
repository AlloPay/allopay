import { deploySafe, getFactory } from 'lib';
import { useSafe } from '@features/safe/SafeProvider';
import { useWallet } from '@features/wallet/WalletProvider';
import { useUpsertSafe } from '@gql/mutations/useUpsertSafe';
import { showInfo, showSuccess } from '@components/Toast';
import { CONFIG } from '~/config';
import { isDeployedState, useIsDeployed } from './useIsDeployed';
import { useSetRecoilState } from 'recoil';

export const useDeploySafe = () => {
  const { groups, deploySalt, safe } = useSafe();
  const isDeployed = useIsDeployed();
  const wallet = useWallet();
  const upsertSafe = useUpsertSafe();
  const setIsDeployed = useSetRecoilState(isDeployedState(safe.address));

  if (isDeployed) return undefined;

  const deploy = async () => {
    showInfo({ text1: 'Deploying safe...', visibilityTime: 8000 });

    const group = groups[0];

    const r = await deploySafe({
      factory: getFactory(CONFIG.factoryAddress, wallet),
      args: [group.approvers],
      signer: wallet,
      salt: deploySalt,
    });
    await r.safe.deployed();

    setIsDeployed(true);

    if (!deploySalt && r.salt) upsertSafe({ deploySalt: r.salt });

    showSuccess('Safe deployed');
  };

  return deploy;
};
