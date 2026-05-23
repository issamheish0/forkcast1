import React, { useEffect } from "react";
import { View, Text, Dimensions } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

export default function AnimatedSplashScreen({
  onAnimationComplete,
}: AnimatedSplashScreenProps) {
  const textOpacity = useSharedValue(0);
  const splashOpacity = useSharedValue(1);

  useEffect(() => {
    // Animate text fade in
    textOpacity.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });

    // Animate splash fade out after delay
    splashOpacity.value = withSequence(
      withDelay(
        1300,
        withTiming(0, {
          duration: 300,
          easing: Easing.bezier(0.4, 0.4, 0.4, 0.4),
        }),
      ),
    );

    // Call completion callback
    const timer = setTimeout(() => {
      onAnimationComplete();
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const splashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: splashOpacity.value,
  }));

  return (
    <Animated.View
      className="absolute inset-0 z-[9999]"
      style={splashAnimatedStyle}
    >
      {/* Background */}
      <View className="absolute inset-0 bg-[#ffece2]" />

      {/* Text Logo */}
      <Animated.View
        className="flex-1 items-center justify-center"
        style={textAnimatedStyle}
      >
        <Image
          source={require("../assets/fork.png")}
          style={{ width: width * 0.7, height: height * 0.2 }}
          contentFit="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}
