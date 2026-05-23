import React, { useEffect, useMemo } from "react";
import {
  View,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  withDelay,
  withSequence,
  runOnJS,
} from "react-native-reanimated";

interface CuisineBurstProps {
  visible: boolean;
  originX: number; // relative to parent container
  originY: number; // relative to parent container
  onComplete?: () => void;
}

const cuisineIcons: ImageSourcePropType[] = [
  require("@/assets/cuisine-categories/american.png"),
  require("@/assets/cuisine-categories/cafe.png"),
  require("@/assets/cuisine-categories/chinese.png"),
  require("@/assets/cuisine-categories/french.png"),
  require("@/assets/cuisine-categories/greek.png"),
  require("@/assets/cuisine-categories/indian.png"),
  require("@/assets/cuisine-categories/international.png"),
  require("@/assets/cuisine-categories/italian.png"),
  require("@/assets/cuisine-categories/japanese.png"),
  require("@/assets/cuisine-categories/lebanese.png"),
  require("@/assets/cuisine-categories/mediterranean.png"),
  require("@/assets/cuisine-categories/mediterrasian.png"),
  require("@/assets/cuisine-categories/mexican.png"),
  require("@/assets/cuisine-categories/seafood.png"),
  require("@/assets/cuisine-categories/spanish.png"),
  require("@/assets/cuisine-categories/thai.png"),
];

const PARTICLE_COUNT = 40;
const DURATION_MS = 1800;

export const CuisineBurst: React.FC<CuisineBurstProps> = ({
  visible,
  originX,
  originY,
  onComplete,
}) => {
  const { width: screenWidth } = Dimensions.get("window");

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }).map((_, index) => {
      // Spread over 360 degrees, with randomness
      const baseAngle = (index / PARTICLE_COUNT) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.6; // +/- ~17 degrees
      const velocity = 240 + Math.random() * 240; // bigger explosion radius
      const size = 28 + Math.floor(Math.random() * 20); // 28-48px icons
      const delay = Math.floor(Math.random() * 120);
      const source =
        cuisineIcons[Math.floor(Math.random() * cuisineIcons.length)];
      return { angle, velocity, size, delay, source };
    });
  }, [visible]);

  const translateXs = particles.map(() => useSharedValue(0));
  const translateYs = particles.map(() => useSharedValue(0));
  const opacities = particles.map(() => useSharedValue(0));
  const rotations = particles.map(() => useSharedValue(0));
  const scales = particles.map(() => useSharedValue(0.9));

  useEffect(() => {
    if (!visible) return;

    particles.forEach((p, i) => {
      // End positions based on angle and velocity
      const targetX = Math.cos(p.angle) * p.velocity;
      // add stronger upward bias so it feels like an explosion
      const targetY = Math.sin(p.angle) * p.velocity - 100;

      opacities[i].value = withDelay(
        p.delay,
        withSequence(
          withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
          withDelay(
            Math.max(0, DURATION_MS - 380),
            withTiming(0, { duration: 380, easing: Easing.inOut(Easing.quad) }),
          ),
        ),
      );

      translateXs[i].value = withDelay(
        p.delay,
        withTiming(targetX, {
          duration: DURATION_MS,
          easing: Easing.out(Easing.quad),
        }),
      );
      translateYs[i].value = withDelay(
        p.delay,
        withTiming(targetY, {
          duration: DURATION_MS,
          easing: Easing.out(Easing.quad),
        }),
      );
      rotations[i].value = withDelay(
        p.delay,
        withTiming(720, { duration: DURATION_MS, easing: Easing.linear }),
      );
      scales[i].value = withDelay(
        p.delay,
        withSequence(
          withTiming(1.15, { duration: 180, easing: Easing.out(Easing.cubic) }),
          withTiming(1.0, { duration: 200, easing: Easing.out(Easing.cubic) }),
        ),
      );
    });

    const timeout = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, DURATION_MS + 200);

    return () => clearTimeout(timeout);
  }, [visible]);

  // Always create animated styles to keep hook order consistent
  const animatedStyles = particles.map((p, i) =>
    useAnimatedStyle(() => {
      "worklet";
      return {
        position: "absolute",
        left: originX - p.size / 2,
        top: originY - p.size / 2,
        width: p.size,
        height: p.size,
        opacity: opacities[i].value,
        transform: [
          { translateX: translateXs[i].value },
          { translateY: translateYs[i].value },
          { scale: scales[i].value },
          // Use rotateZ with deg unit; Animated.Image transforms are unreliable
          // on Fabric, so we apply transform on an Animated.View wrapper below.
          { rotateZ: `${rotations[i].value}deg` },
        ],
      };
    }),
  );

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Animated.View key={i} style={animatedStyles[i]}>
          <Image
            source={p.source}
            style={{ width: p.size, height: p.size }}
            resizeMode="contain"
          />
        </Animated.View>
      ))}
    </View>
  );
};

export default CuisineBurst;
