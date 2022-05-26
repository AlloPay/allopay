import { SECONDARY_ICON_SIZE } from '@components/list/Item';
import { showError } from '@components/Toast';
import { MaterialIcons } from '@expo/vector-icons';
import { ChildrenProps } from '@util/children';
import { Animated } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useTheme } from 'react-native-paper';

const AnimatedMaterialIcon = Animated.createAnimatedComponent(MaterialIcons);

const BUTTON_WIDTH = 64;

export interface SwipeToDeleteProps extends ChildrenProps {
  onDelete?: () => void;
  disabled?: boolean;
}

export const SwipeToDelete = ({
  children,
  onDelete,
  disabled,
}: SwipeToDeleteProps) => {
  const { colors } = useTheme();

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation,
    _dragX: Animated.AnimatedInterpolation,
  ) => {
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [BUTTON_WIDTH, 0],
    });

    return (
      <Animated.View style={{ width: BUTTON_WIDTH }}>
        <RectButton
          onPress={onDelete}
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: !disabled ? colors.delete : colors.disabled,
          }}
        >
          <AnimatedMaterialIcon
            name="delete"
            size={SECONDARY_ICON_SIZE}
            color={colors.onSurface}
          />
        </RectButton>
      </Animated.View>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions}>{children}</Swipeable>
  );
};
