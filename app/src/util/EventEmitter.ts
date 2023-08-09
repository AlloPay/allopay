import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Observable, firstValueFrom } from 'rxjs';
import { StackNavigatorParamList } from '~/navigation/StackNavigator';

export type Listener<T> = (params: T) => void;

/**
 * @deprecated Use `rxjs Subject` instead
 */
export class EventEmitter<T> {
  readonly listeners: Set<Listener<T>> = new Set();

  emit(params: T) {
    const n = this.listeners.size;
    this.listeners.forEach((listener) => listener(params));
    return n;
  }

  getEvent() {
    return new Promise<T>((resolve) => {
      const listener = (params: T) => {
        this.listeners.delete(listener);
        resolve(params);
      };

      this.listeners.add(listener);
    });
  }

  /**
   * @deprecated Use `createUseEvent()` instead.
   */
  createUseSelect<
    RouteName extends keyof StackNavigatorParamList,
    Defaults extends Partial<StackNavigatorParamList[RouteName]>,
  >(route: RouteName, creationDefaults?: Partial<StackNavigatorParamList[RouteName]>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const emitter = this;
    return (hookDefaults?: Defaults) => {
      const { navigate, goBack } = useNavigation();

      return useCallback(
        async (
          ...args: Defaults extends StackNavigatorParamList[RouteName] | undefined
            ? [] | [Partial<StackNavigatorParamList[RouteName]>]
            : [StackNavigatorParamList[RouteName]]
        ) => {
          const p = emitter.getEvent();

          (navigate as any)(route, {
            ...(creationDefaults ?? {}),
            ...(hookDefaults ?? {}),
            ...(args[0] ?? {}),
          });

          await p;
          goBack();

          return p;
        },
        [goBack, hookDefaults, navigate],
      );
    };
  }
}

export const useEvent = <T>(emitter: EventEmitter<T>) => {
  const [value, setValue] = useState<T | undefined>();

  useEffect(() => {
    const listener: Listener<T> = (params) => setValue(params);
    emitter.listeners.add(listener);

    return () => {
      emitter.listeners.delete(listener);
    };
  }, [emitter.listeners]);

  return value;
};

export function createUseEvent<
  T,
  RouteName extends keyof StackNavigatorParamList,
  Defaults extends Partial<StackNavigatorParamList[RouteName]>,
>(
  observable: Observable<T>,
  route: RouteName,
  creationDefaults?: Partial<StackNavigatorParamList[RouteName]>,
) {
  return function useEvent(hookDefaults?: Defaults) {
    const { navigate, goBack } = useNavigation();

    return useCallback(
      async (
        params: Defaults extends StackNavigatorParamList[RouteName] | undefined
          ? Partial<StackNavigatorParamList[RouteName]>
          : StackNavigatorParamList[RouteName],
        withObservable: (obs: Observable<T>) => Observable<T>,
      ) => {
        const p = withObservable
          ? firstValueFrom(withObservable(observable))
          : firstValueFrom(observable);

        (navigate as any)(route, {
          ...(creationDefaults ?? {}),
          ...(hookDefaults ?? {}),
          params,
        });

        await p;
        goBack();

        return p;
      },
      [goBack, hookDefaults, navigate],
    );
  };
}
