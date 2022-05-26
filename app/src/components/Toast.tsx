import { useTheme } from 'react-native-paper';
import RnToast, {
  BaseToast,
  ToastShowParams,
} from 'react-native-toast-message';

export type ShowParams = ToastShowParams | string;

const getParams = (params: ShowParams): ToastShowParams =>
  typeof params === 'string' ? { text1: params } : params;

export const showSuccess = (params: ShowParams) =>
  RnToast.show({
    ...getParams(params),
    type: 'success',
  });

export const showInfo = (params: ShowParams) =>
  RnToast.show({
    ...getParams(params),
    type: 'info',
  });

export const showError = (params: ShowParams) =>
  RnToast.show({
    ...getParams(params),
    type: 'error',
  });

export const Toast = () => {
  const { colors } = useTheme();

  return (
    <RnToast
      config={{
        info: (props) => (
          <BaseToast
            {...props}
            style={{
              backgroundColor: colors.primaryContainer,
              borderLeftColor: colors.info,
            }}
            text1Style={{
              color: colors.onPrimaryContainer,
            }}
          />
        ),

        success: (props) => (
          <BaseToast
            {...props}
            style={{
              backgroundColor: colors.primaryContainer,
              borderLeftColor: colors.success,
            }}
            text1Style={{
              color: colors.onPrimaryContainer,
            }}
          />
        ),

        error: (props) => (
          <BaseToast
            {...props}
            style={{
              backgroundColor: colors.primaryContainer,
              borderLeftColor: colors.error,
            }}
            text1Style={{
              color: colors.onPrimaryContainer,
            }}
          />
        ),
      }}
    />
  );
};
