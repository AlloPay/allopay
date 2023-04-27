import { wrapJSON } from './wrapJson';

const PATTERN = /^BigInt::([0-9]+)$/;
const toString = (value: bigint) => `BigInt::${value}`;

/* This DOES NOT WORK
 * .toString() is called on the bigint value before it is passed to the replacer function
 * and we patch BigInt.toString() so the value is stringified 3n -> '3' by the time it reaches tryStringify
 */

export default wrapJSON({
  tryStringify: (_key, value) => {
    if (typeof value === 'bigint') return toString(value);
  },
  tryParse: (_key, value) => {
    if (typeof value === 'string') {
      const matches = value.match(PATTERN);
      if (matches) {
        try {
          return BigInt(matches[1]);
        } catch (e) {
          console.error(`Failed to convert from "${matches[1]}" to BigInt: ${e}"`);
        }
      }
    }
  },
});
