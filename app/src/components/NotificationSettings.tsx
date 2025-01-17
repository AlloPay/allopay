import { View } from 'react-native';
import { persistedAtom } from '~/lib/persistedAtom';
import { useImmerAtom } from 'jotai-immer';
import * as Notifications from 'expo-notifications';
import type { NotificationChannelInput } from 'expo-notifications';
import { Divider, Switch, Text } from 'react-native-paper';
import { Actions } from '#/layout/Actions';
import { Button } from '#/Button';
import { ListItem } from '#/list/ListItem';
import { useAtomValue } from 'jotai';
import { IconProps, OutboundIcon, UpdateIcon, materialCommunityIcon } from '@theme/icons';
import { FC } from 'react';
import { createStyles } from '@theme/styles';

export type NotificationChannel = 'product' | 'activity' | 'transfers';
export const NotificationChannelConfig: Record<
  NotificationChannel,
  NotificationChannelInput & { icon?: FC<IconProps> }
> = {
  product: {
    name: 'Product updates',
    description: 'New features and announcements',
    icon: UpdateIcon,
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  transfers: {
    name: 'Transfers',
    description: 'Incoming tokens and allowances',
    icon: OutboundIcon,
    importance: Notifications.AndroidImportance.DEFAULT,
    showBadge: false,
    enableLights: false,
    enableVibrate: false,
  },
  activity: {
    name: 'Account activity',
    description: 'Proposal approvals',
    icon: materialCommunityIcon('chart-timeline-variant'),
    importance: Notifications.AndroidImportance.MAX,
    showBadge: true,
    enableLights: true,
    enableVibrate: true,
  },
};

const DEFAULT_SETTINGS: Record<NotificationChannel, boolean> = {
  activity: true,
  product: true,
  transfers: true,
};

const NOTIFICATIONS_ATOM = persistedAtom<Partial<Record<NotificationChannel, boolean>>>(
  'Notifications',
  DEFAULT_SETTINGS,
);

export const useNotificationSettings = () => ({
  ...DEFAULT_SETTINGS,
  ...useAtomValue(NOTIFICATIONS_ATOM),
});

export interface NotificationSettingsProps {
  next?: () => void;
}

export function NotificationSettings({ next }: NotificationSettingsProps) {
  const [settings, update] = useImmerAtom(NOTIFICATIONS_ATOM);

  const [perm, requestPerm] = Notifications.usePermissions({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: true,
      provideAppNotificationSettings: true,
    },
  });

  return (
    <>
      <Text variant="bodyLarge" style={styles.description}>
        Which notifications do you want to receive?
      </Text>

      {Object.entries(NotificationChannelConfig).map(([channel, config], i, channels) => (
        <View key={channel}>
          <ListItem
            leading={config.icon}
            headline={config.name}
            supporting={config.description}
            trailing={
              <Switch
                value={settings[channel as NotificationChannel] ?? true}
                onValueChange={(v) =>
                  update((s) => {
                    s[channel as NotificationChannel] = v;
                  })
                }
              />
            }
          />
          {i < channels.length - 1 && <Divider />}
        </View>
      ))}

      <Actions horizontal>
        {(!perm?.granted || next) && (
          <Button
            mode="contained"
            onPress={async () => {
              await requestPerm();
              next?.();
            }}
          >
            {perm?.granted ? 'Continue' : 'Enable'}
          </Button>
        )}

        {!perm?.granted && next && <Button onPress={next}>Skip</Button>}
      </Actions>
    </>
  );
}

const styles = createStyles({
  description: {
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 16,
  },
});
