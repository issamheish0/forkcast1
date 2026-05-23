import { Link } from "expo-router";
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-between p-6">
        <View className="mt-16 items-center">
          <Text className="text-5xl font-extrabold text-primary">ForkCast</Text>
          <Text className="mt-3 text-center text-base text-muted-foreground">
            Book the best tables in town. Effortlessly.
          </Text>
        </View>

        <View className="items-center">
          <Text className="text-4xl font-bold text-foreground">Discover.</Text>
          <Text className="text-4xl font-bold text-foreground">Book.</Text>
          <Text className="text-4xl font-bold text-foreground">Enjoy.</Text>
        </View>

        <View className="gap-3">
          <Link href="/sign-up" asChild>
            <Pressable className="rounded-2xl bg-primary py-4 items-center">
              <Text className="text-base font-semibold text-primary-foreground">
                Create an account
              </Text>
            </Pressable>
          </Link>
          <Link href="/sign-in" asChild>
            <Pressable className="rounded-2xl border border-border py-4 items-center">
              <Text className="text-base font-semibold text-foreground">
                I already have an account
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
