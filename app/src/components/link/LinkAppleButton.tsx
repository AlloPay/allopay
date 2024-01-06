import { Fab } from '~/components/Fab';
import { FragmentType, gql, useFragment } from '~/gql/api';
import { useLinkApple } from '~/hooks/cloud/useLinkApple';
import { AppleWhiteIcon } from '~/util/theme/icons';
import { createStyles, useStyles } from '~/util/theme/styles';

const User = gql(/* GraphQL */ `
  fragment LinkAppleButton_User on User {
    id
    ...useLinkApple_User
  }
`);

export interface LinkAppleButtonProps {
  user: FragmentType<typeof User>;
  onLink?: () => void | Promise<void>;
}

export function LinkAppleButton({ onLink, ...props }: LinkAppleButtonProps) {
  const { styles } = useStyles(stylesheet);
  const user = useFragment(User, props.user);
  const link = useLinkApple({ user });

  if (!link) return null;

  return (
    <Fab
      position="relative"
      icon={AppleWhiteIcon}
      color={styles.icon.color}
      style={styles.container}
      onPress={async () => {
        if (await link()) await onLink?.();
      }}
    />
  );
}

const stylesheet = createStyles(({ dark }) => ({
  container: {
    backgroundColor: dark ? 'white' : 'black',
  },
  icon: {
    color: dark ? 'black' : 'white',
  },
}));
