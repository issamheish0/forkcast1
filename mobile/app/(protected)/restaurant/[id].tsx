import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ExternalLink, Heart, MapPin, Phone, Star } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Restaurant } from "@/lib/types";
import { useAuth } from "@/context/auth-provider";

function openInMaps(restaurant: Restaurant) {
  const { latitude, longitude, address, name } = restaurant;
  if (latitude && longitude) {
    const label = encodeURIComponent(name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    if (url) Linking.openURL(url);
  } else if (address) {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    );
  }
}

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: r }, fav] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", id).maybeSingle(),
        user
          ? supabase
              .from("favorites")
              .select("restaurant_id")
              .eq("user_id", user.id)
              .eq("restaurant_id", id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setRestaurant(r as Restaurant);
      setIsFav(!!fav?.data);
      setLoading(false);
    })();
  }, [id, user]);

  const toggleFav = async () => {
    if (!user || !restaurant || favBusy) return;
    setFavBusy(true);
    if (isFav) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("restaurant_id", restaurant.id);
      setIsFav(false);
    } else {
      await supabase
        .from("favorites")
        .insert({ user_id: user.id, restaurant_id: restaurant.id });
      setIsFav(true);
    }
    setFavBusy(false);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">Restaurant not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="pb-32">
        <View>
          <Image
            source={{ uri: restaurant.main_image_url ?? undefined }}
            className="h-72 w-full bg-muted"
          />
          <SafeAreaView
            edges={["top"]}
            className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-4"
          >
            <Pressable
              onPress={() => router.back()}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
            >
              <ArrowLeft size={20} color="#5A1E32" />
            </Pressable>
            <Pressable
              onPress={toggleFav}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
            >
              <Heart
                size={20}
                color={isFav ? "#DC2626" : "#5A1E32"}
                fill={isFav ? "#DC2626" : "transparent"}
              />
            </Pressable>
          </SafeAreaView>
        </View>

        <View className="p-6">
          <Text className="text-2xl font-bold text-foreground">{restaurant.name}</Text>
          <View className="mt-2 flex-row items-center gap-2">
            <Star size={16} color="#EAB308" fill="#EAB308" />
            <Text className="text-foreground">
              {Number(restaurant.average_rating ?? 0).toFixed(1)}
            </Text>
            <Text className="text-muted-foreground">·</Text>
            <Text className="text-muted-foreground">
              {restaurant.cuisine_type} · {"$".repeat(restaurant.price_range ?? 2)}
            </Text>
          </View>

          {restaurant.description && (
            <Text className="mt-4 text-foreground leading-6">{restaurant.description}</Text>
          )}

          <View className="mt-6 gap-3">
            {restaurant.address && (
              <Pressable
                onPress={() => openInMaps(restaurant)}
                className="flex-row items-center gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-3 active:opacity-70"
              >
                <MapPin size={18} color="#7A2342" />
                <Text className="flex-1 text-foreground">{restaurant.address}</Text>
                <ExternalLink size={14} color="#7A6A6E" />
              </Pressable>
            )}
            {restaurant.phone_number && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${restaurant.phone_number}`)}
                className="flex-row items-center gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-3 active:opacity-70"
              >
                <Phone size={18} color="#7A2342" />
                <Text className="flex-1 text-foreground">{restaurant.phone_number}</Text>
                <ExternalLink size={14} color="#7A6A6E" />
              </Pressable>
            )}
          </View>

          <View className="mt-6 rounded-2xl bg-secondary p-4">
            <Text className="text-sm text-secondary-foreground">
              {restaurant.booking_policy === "instant"
                ? "✓ Instant booking — confirmed immediately."
                : "⌛ Request booking — the restaurant will confirm or decline."}
            </Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              Party size: {restaurant.min_party_size}–{restaurant.max_party_size} guests
            </Text>
          </View>
        </View>
      </ScrollView>

      <SafeAreaView
        edges={["bottom"]}
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-6 pt-3"
      >
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(protected)/booking/create",
              params: { restaurantId: restaurant.id },
            })
          }
          className="items-center rounded-2xl bg-primary py-4"
        >
          <Text className="text-base font-semibold text-primary-foreground">Book a table</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
