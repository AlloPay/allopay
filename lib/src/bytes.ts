import { Bytes, BytesLike } from 'ethers';
import { arrayify } from 'ethers/lib/utils';

export type Bytes8 = BytesLike;

export const byteslikeToBuffer = (b: BytesLike): Buffer =>
  Buffer.from(arrayify(b));

export const bufferToBytes = (b: Buffer): Bytes =>
  Uint8Array.from([...b.values()]);
