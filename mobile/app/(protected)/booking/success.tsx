import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Clock } from "lucide-react-native";

export default function BookingSuccess() {
  const router = useRouter();
  const { code, status, restaurantName } = useLocalSearchParams<{
    code: string;
    status: string;
    restaurantName: string;
  }>();

  const isConfirmed = status === "confirmed";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-8">
        <View
          className={`h-20 w-20 items-center justify-center rounded-full ${
            isConfirmed ? "bg-success" : "bg-warning"
          }`}
        >
          {isConfirmed ? (
            <Check size={36} color="#fff" />
          ) : (
            <Clock size={36} color="#1F2937" />
          )}
        </View>
        <Text className="mt-6 text-2xl font-bold text-foreground">
          {isConfirmed ? "Booking confirmed!" : "Request sent"}
        </Text>
        <Text className="mt-2 text-center text-muted-foreground">
          {isConfirmed
            ? `Your table at ${restaurantName} is reserved.`
            : `${restaurantName} will review your request and confirm shortly.`}
        </Text>

        <View className="mt-8 rounded-2xl bg-card border border-border px-6 py-4">
          <Text className="text-xs text-muted-foreground">Confirmation code</Text>
          <Text className="mt-1 text-2xl font-bold tracking-widest text-foreground">
            {code}
          </Text>
        </View>
      </View>

      <View className="p-6">
        <Pressable
          onPress={() => router.replace("/(protected)/(tabs)")}
          className="items-center rounded-2xl bg-primary py-4"
        >
          <Text className="text-base font-semibold text-primary-foreground">
            Back to home
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
