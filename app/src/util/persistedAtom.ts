import { WritableAtom, atom } from 'jotai';
import { RESET, createJSONStorage, unstable_NO_STORAGE_VALUE } from 'jotai/utils';
import type { AsyncStorage as TAsyncStorage } from 'jotai/vanilla/utils/atomWithStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

interface StorageOptions<V, U extends AnyJson> {
  secure?: SecureStore.SecureStoreOptions;
  stringifiy?: (value: V) => U;
  parse?: (value: U) => V;
}

// Based off https://github.com/pmndrs/jotai/blob/main/src/vanilla/utils/atomWithStorage.ts
// Primary difference is that this persists the initialValue
export const persistedAtom = <V, U extends AnyJson = AnyJson>(
  key: string,
  initialValue: V,
  options?: StorageOptions<V, U>,
): WritableAtom<V, [SetStateActionWithReset<V>], V> => {
  const storage = getStorage(options);
  const baseAtom = atom(initialValue);
  baseAtom.debugLabel = `${key}::base`;

  baseAtom.onMount = (setAtom) => {
    storage.getItem(key).then((v) => {
      if (v === unstable_NO_STORAGE_VALUE) {
        storage.setItem(key, initialValue);
      } else if (v !== initialValue) {
        setAtom(v);
      }
    });

    if (storage.subscribe) return storage.subscribe(key, setAtom);
  };

  const pAtom = atom(
    (get) => get(baseAtom),
    (get, set, update: SetStateActionWithReset<V>) => {
      const nextValue =
        typeof update === 'function'
          ? (update as (prev: V) => V | typeof RESET)(get(baseAtom))
          : update;

      const newValue = nextValue === RESET ? initialValue : nextValue;

      set(baseAtom, newValue);
      storage.setItem(key, newValue);

      return newValue;
    },
  );
  pAtom.debugLabel = key;

  return pAtom;
};

const ASYNC_STORAGE = createJSONStorage(() => AsyncStorage);

const getStorage = <V, U extends AnyJson>({
  secure,
  parse,
  stringifiy,
}: StorageOptions<V, U> = {}): TAsyncStorage<V> => {
  const store = secure
    ? createJSONStorage<U>(() => ({
        getItem: (key) => SecureStore.getItemAsync(key, secure),
        setItem: (key, newValue) => SecureStore.setItemAsync(key, newValue, secure),
        removeItem: (key) => SecureStore.deleteItemAsync(key, secure),
      }))
    : (ASYNC_STORAGE as TAsyncStorage<U>);

  const getItem: TAsyncStorage<V>['getItem'] = parse
    ? async (key) => {
        const r = await store.getItem(key);
        return r === unstable_NO_STORAGE_VALUE ? unstable_NO_STORAGE_VALUE : parse(r);
      }
    : (store.getItem as TAsyncStorage<V>['getItem']);

  const setItem: TAsyncStorage<V>['setItem'] = stringifiy
    ? async (key, newValue) => store.setItem(key, stringifiy(newValue))
    : (store.setItem as unknown as TAsyncStorage<V>['setItem']);

  return {
    getItem,
    setItem,
    removeItem: (key) => store.removeItem(key),
  };
};

type SetStateActionWithReset<Value> =
  | Value
  | typeof RESET
  | ((prev: Value) => Value | typeof RESET);

type AnyJson = boolean | number | string | null | JsonArray | JsonMap;
interface JsonMap {
  [key: string]: AnyJson;
}
interface JsonArray extends Array<AnyJson> {}
