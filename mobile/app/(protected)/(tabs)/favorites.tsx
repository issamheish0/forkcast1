import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Restaurant } from "@/lib/types";
import { RestaurantCard } from "@/components/restaurant-card";
import { useAuth } from "@/context/auth-provider";

export default function Favorites() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("favorites")
      .select("restaurant:restaurants(*)")
      .eq("user_id", user.id);
    const list = (data ?? [])
      .map((row: any) => row.restaurant as Restaurant)
      .filter(Boolean);
    setRestaurants(list);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="px-6 pt-4">
        <Text className="mt-1 text-muted-foreground">Your saved restaurants.</Text>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-12" />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              variant="row"
              onPress={() => router.push(`/(protected)/restaurant/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Text className="mt-12 text-center text-muted-foreground">
              No favorites yet. Tap the heart on a restaurant.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
