import { MaterialCommunityIcons } from '@expo/vector-icons';
import { makeStyles } from '@theme/makeStyles';
import { ComponentPropsWithoutRef, useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const getRotation = (expanded?: boolean) => (expanded ? -180 : 0);

export type MaterialCommunityIconsProps = ComponentPropsWithoutRef<
  typeof MaterialCommunityIcons
>;

export const AnimatedMaterialCommunityIcons = Animated.createAnimatedComponent(
  MaterialCommunityIcons,
);

export interface ChevronProps
  extends Omit<MaterialCommunityIconsProps, 'name'> {
  expanded?: boolean;
}

export const Chevron = ({ expanded, style, ...iconProps }: ChevronProps) => {
  const styles = useStyles();

  const rotation = useSharedValue(getRotation(expanded));
  const transformStyle = useAnimatedStyle(() => ({
    transform: [{ rotateX: `${rotation.value}deg` }],
  }));

  useEffect(() => {
    rotation.value = withTiming(getRotation(expanded));
  }, [expanded, rotation]);

  return (
    <AnimatedMaterialCommunityIcons
      name="chevron-down"
      {...iconProps}
      style={[styles.icon, transformStyle, style]}
    />
  );
};

const useStyles = makeStyles(({ colors, iconSize }) => ({
  icon: {
    fontSize: iconSize.small,
    color: colors.onSurface,
  },
}));
