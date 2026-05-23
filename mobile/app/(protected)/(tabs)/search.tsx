import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search as SearchIcon } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Restaurant } from "@/lib/types";
import { RestaurantCard } from "@/components/restaurant-card";

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("restaurants").select("*").limit(100);
      setRestaurants((data ?? []) as Restaurant[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.cuisine_type ?? "").toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q),
    );
  }, [restaurants, query]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="p-6">
        <Text className="text-2xl font-bold text-foreground">Search</Text>
        <View className="mt-4 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3">
          <SearchIcon size={18} color="#7A6A6E" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Restaurant, cuisine, area..."
            className="flex-1 py-3 text-foreground"
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-12" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, gap: 12 }}
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              variant="row"
              onPress={() => router.push(`/(protected)/restaurant/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Text className="mt-12 text-center text-muted-foreground">
              No restaurants found.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
