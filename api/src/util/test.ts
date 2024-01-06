import { randomBytes } from 'crypto';

import { asAddress, asHex, asUAddress } from 'lib';
import { UserContext } from '~/request/ctx';

export const randomHex = (nBytes: number) => asHex('0x' + randomBytes(nBytes).toString('hex'));

export const randomAddress = () => asAddress(randomHex(20));

export const randomUAddress = () => asUAddress(randomAddress(), 'zksync-goerli');

export const randomHash = () => asHex(randomHex(32));

export const randomLabel = () => randomHex(19);

export const randomUser = (): UserContext => ({ approver: randomAddress(), accounts: [] });

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
