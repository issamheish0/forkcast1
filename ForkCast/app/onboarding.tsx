import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Dimensions,
  Image as RNImage,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, Muted, P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

const { width, height } = Dimensions.get("window");

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  image: any;
  cta?: string;
};

const SLIDES: Slide[] = [
  {
    key: "discover",
    title: "Discover great restaurants",
    subtitle: "Curated lists, trending spots, and picks for your tastes.",
    image: require("@/assets/onboarding/discover.png"),
  },
  {
    key: "book",
    title: "Book in a few taps",
    subtitle: "Live availability, instant booking, and smart reminders.",
    image: require("@/assets/onboarding/book.png"),
  },
  {
    key: "friends",
    title: "Plan with friends",
    subtitle: "Invite, coordinate, and share plans in one place.",
    image: require("@/assets/onboarding/friends.png"),
  },
  {
    key: "rewards",
    title: "Earn rewards",
    subtitle: "Collect points and unlock perks as you dine.",
    image: require("@/assets/onboarding/rewards.png"),
  },
  {
    key: "ai",
    title: "Not finding a place to eat? Ask Dinemate AI",
    subtitle: "Dinemate AI will help you find the perfect restaurant.",
    image: require("@/assets/onboarding/ai.png"),
    cta: "Get started",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { updateProfile } = useAuth();

  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const lastIndexRef = useRef(0);

  const getItemLayout = (
    _: unknown,
    itemIndex: number,
  ): { length: number; offset: number; index: number } => ({
    length: width,
    offset: width * itemIndex,
    index: itemIndex,
  });

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / width);
    const clamped = Math.min(Math.max(0, newIndex), SLIDES.length - 1);
    if (clamped !== lastIndexRef.current) {
      lastIndexRef.current = clamped;
      setIndex(clamped);
    }
  };

  const handleComplete = async (): Promise<void> => {
    if (isCompleting) return;

    try {
      setIsCompleting(true);
      await updateProfile({ onboarded: true });
      router.replace("/preferred-cuisines");
    } catch {
      router.replace("/preferred-cuisines");
    }
  };

  const indicators = useMemo(
    () => SLIDES.map((_, i) => <Dot key={i} active={i === index} />),
    [index],
  );

  const isLastSlide = index === SLIDES.length - 1;
  const showSwipeHint = !isLastSlide;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          const aspect = 400 / 700;
          const maxW = Math.floor(width * 0.9);
          const maxH = Math.floor(height * 0.48);
          const displayWidth = Math.min(maxW, Math.floor(maxH * aspect));
          const displayHeight = Math.floor(displayWidth / aspect);

          return (
            <View
              style={{ width }}
              className="flex-1 items-center justify-center p-6 gap-6"
            >
              <RNImage
                source={item.image}
                resizeMode="contain"
                style={{
                  width: displayWidth,
                  height: displayHeight,
                  borderRadius: 14,
                }}
              />
              <H1 className="text-center">{item.title}</H1>
              <P className="text-center text-muted-foreground">
                {item.subtitle}
              </P>
            </View>
          );
        }}
      />

      <View className="px-6 pb-6 gap-4">
        <View className="flex-row self-center gap-2">{indicators}</View>

        {showSwipeHint ? (
          <SwipeHint />
        ) : (
          <>
            <Button
              className="w-full"
              onPress={handleComplete}
              disabled={isCompleting}
            >
              <Text>{SLIDES[SLIDES.length - 1].cta ?? "Get started"}</Text>
            </Button>
            <Muted className="text-center">
              You can change these anytime in Settings.
            </Muted>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function SwipeHint() {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(12, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View className="items-center gap-2 py-2">
      <Animated.View style={animatedStyle} className="flex-row items-center">
        <ChevronRight size={24} color="#792339" />
      </Animated.View>
      <Muted className="text-center text-sm">Swipe to explore</Muted>
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  return (
    <View
      className="rounded-full bg-primary"
      style={{
        width: active ? 10 : 8,
        height: 8,
        opacity: active ? 1 : 0.5,
        borderRadius: 4,
      }}
    />
  );
}
