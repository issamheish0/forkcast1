import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useColorScheme } from "@/lib/useColorScheme";

interface SkeletonPlaceholderProps {
  width: number | string;
  height: number | string;
  borderRadius?: number;
  style?: any;
}

const SkeletonPlaceholder: React.FC<SkeletonPlaceholderProps> = ({
  width,
  height,
  borderRadius = 4,
  style,
}) => {
  const pulseAnim = useSharedValue(0);
  const { isDarkColorScheme } = useColorScheme();

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseAnim.value * 0.4 + 0.6, // 0.6 to 1.0
    };
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDarkColorScheme ? "#2A2F36" : "#E1E9EE",
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

export default SkeletonPlaceholder;
