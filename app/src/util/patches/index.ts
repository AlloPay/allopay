// node-libs-react-native provides many shims
// Among those, which are overridden below: Buffer, atob, btoa
import 'node-libs-react-native/globals';

// Buffer
import { Buffer } from '@craftzdog/react-native-buffer';
global.Buffer = Buffer as unknown as typeof global.Buffer;

// Crypto
import 'react-native-quick-crypto'; // crypto

// Base64 (atob, btoa)
import { shim } from 'react-native-quick-base64';
shim();

// Provides fallback shims for missing features
// Crypto needs to be shimmed before this - https://docs.ethers.org/v5/cookbook/react-native/
import '@ethersproject/shims';

import '@walletconnect/react-native-compat';

// Log ethers events
import './ethersLogger';

// Intl pollyfills - required for iOS
import './intl';

import 'core-js/actual/url';
import 'core-js/actual/url-search-params'; // Required by URQL persisted-exchange

import '@total-typescript/ts-reset';

// Immer features
import { enableMapSet } from 'immer';
enableMapSet();

// BigInt
declare global {
  interface BigInt {
    toJSON: () => string;
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export default {};
