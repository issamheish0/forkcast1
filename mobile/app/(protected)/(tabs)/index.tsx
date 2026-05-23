import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Restaurant } from "@/lib/types";
import { RestaurantCard } from "@/components/restaurant-card";
import { useAuth } from "@/context/auth-provider";

export default function Home() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .order("average_rating", { ascending: false })
      .limit(50);
    if (!error && data) setRestaurants(data as Restaurant[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Derive unique cuisines from actual data
  const cuisines = useMemo(
    () =>
      Array.from(
        new Set(
          restaurants.flatMap((r) => [
            ...(r.cuisine_type ? [r.cuisine_type] : []),
            ...(r.cuisine_types ?? []),
          ]),
        ),
      ).sort(),
    [restaurants],
  );

  const filtered = useMemo(
    () =>
      selectedCuisine
        ? restaurants.filter(
            (r) =>
              r.cuisine_type === selectedCuisine ||
              (r.cuisine_types ?? []).includes(selectedCuisine),
          )
        : restaurants,
    [restaurants, selectedCuisine],
  );

  const featured = filtered.slice(0, 5);
  const popular = filtered.slice(0, 15);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerClassName="pb-12"
      >
        <View className="px-6 pt-4">
          
          <Text className="text-2xl font-bold text-foreground">Find your next table</Text>
        </View>

        {loading ? (
          <View className="mt-20 items-center">
            <ActivityIndicator />
          </View>
        ) : (
          <>
            {/* Cuisine filter pills */}
            {cuisines.length > 0 && (
              <View className="mt-5">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
                >
                  <Pressable
                    onPress={() => setSelectedCuisine(null)}
                    className={`rounded-full px-4 py-2 ${
                      selectedCuisine === null
                        ? "bg-primary"
                        : "bg-secondary border border-border"
                    }`}
                  >
                    <Text
                      className={
                        selectedCuisine === null
                          ? "font-semibold text-primary-foreground"
                          : "text-secondary-foreground"
                      }
                    >
                      All
                    </Text>
                  </Pressable>
                  {cuisines.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() =>
                        setSelectedCuisine((prev) => (prev === c ? null : c))
                      }
                      className={`rounded-full px-4 py-2 ${
                        selectedCuisine === c
                          ? "bg-primary"
                          : "bg-secondary border border-border"
                      }`}
                    >
                      <Text
                        className={
                          selectedCuisine === c
                            ? "font-semibold text-primary-foreground"
                            : "text-secondary-foreground"
                        }
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Section title={selectedCuisine ? `${selectedCuisine} — Featured` : "Featured"}>
              {featured.length === 0 ? (
                <Text className="px-6 text-muted-foreground">No results.</Text>
              ) : (
                <FlatList
                  data={featured}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(r) => r.id}
                  contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
                  renderItem={({ item }) => (
                    <RestaurantCard
                      restaurant={item}
                      onPress={() => router.push(`/(protected)/restaurant/${item.id}`)}
                    />
                  )}
                />
              )}
            </Section>

            <Section title={selectedCuisine ? selectedCuisine : "Popular near you"}>
              <View className="gap-3 px-6">
                {popular.map((r) => (
                  <RestaurantCard
                    key={r.id}
                    restaurant={r}
                    variant="row"
                    onPress={() => router.push(`/(protected)/restaurant/${r.id}`)}
                  />
                ))}
              </View>
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="px-6 pb-3 text-lg font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}
