import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ExternalLink, FileText, Heart, List, MapPin, Phone, Star, X } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Menu, MenuItem, Restaurant, RestaurantImage } from "@/lib/types";
import { useAuth } from "@/context/auth-provider";

const SCREEN_WIDTH = Dimensions.get("window").width;

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
  const [secondaryImages, setSecondaryImages] = useState<RestaurantImage[]>([]);
  const [menus, setMenus] = useState<(Menu & { menu_items: MenuItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: r }, fav, { data: imgs }, { data: menuData }] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", id).maybeSingle(),
        user
          ? supabase
              .from("favorites")
              .select("restaurant_id")
              .eq("user_id", user.id)
              .eq("restaurant_id", id)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase
          .from("restaurant_images")
          .select("*")
          .eq("restaurant_id", id)
          .order("position"),
        supabase
          .from("menus")
          .select("*, menu_items(*)")
          .eq("restaurant_id", id)
          .order("position"),
      ]);
      setRestaurant(r as Restaurant);
      setSecondaryImages((imgs as RestaurantImage[]) ?? []);
      setMenus((menuData as any[]) ?? []);
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
        {/* Image carousel */}
        <View className="relative">
          {(() => {
            const allImages = [
              ...(restaurant.main_image_url ? [restaurant.main_image_url] : []),
              ...secondaryImages.map((i) => i.url),
            ];
            if (allImages.length === 0) {
              return <View className="h-72 w-full bg-muted" />;
            }
            if (allImages.length === 1) {
              return (
                <Image
                  source={{ uri: allImages[0] }}
                  className="h-72 w-full bg-muted"
                />
              );
            }
            return (
              <View>
                <FlatList
                  data={allImages}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => String(i)}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setCarouselIndex(idx);
                  }}
                  renderItem={({ item }) => (
                    <Image
                      source={{ uri: item }}
                      style={{ width: SCREEN_WIDTH, height: 288 }}
                      className="bg-muted"
                    />
                  )}
                />
                {/* Dots indicator */}
                <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
                  {allImages.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: i === carouselIndex ? 18 : 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: i === carouselIndex ? "#fff" : "rgba(255,255,255,0.5)",
                      }}
                    />
                  ))}
                </View>
              </View>
            );
          })()}

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
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <Star size={16} color="#EAB308" fill="#EAB308" />
            <Text className="text-foreground">
              {Number(restaurant.average_rating ?? 0).toFixed(1)}
            </Text>
            <Text className="text-muted-foreground">·</Text>
            {[
              ...(restaurant.cuisine_type ? [restaurant.cuisine_type] : []),
              ...(restaurant.cuisine_types ?? []),
            ].map((c, i) => (
              <View
                key={c}
                className={`rounded-full px-2.5 py-0.5 ${i === 0 ? "bg-primary/15" : "bg-secondary"}`}
              >
                <Text className={`text-xs font-medium ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {c}
                </Text>
              </View>
            ))}
            <Text className="text-muted-foreground">· {"$".repeat(restaurant.price_range ?? 2)}</Text>
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

          {/* Menus section */}
          {menus.length > 0 && (
            <View className="mt-6">
              <Text className="mb-3 text-lg font-bold text-foreground">Menus</Text>
              <View className="gap-2">
                {menus.map((menu) => (
                  <MenuRow key={menu.id} menu={menu} />
                ))}
              </View>
            </View>
          )}
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

/* ─── MenuRow: renders one menu entry depending on type ─── */

function MenuRow({ menu }: { menu: Menu & { menu_items: MenuItem[] } }) {
  const [showManual, setShowManual] = useState(false);
  const [showImage, setShowImage] = useState(false);

  if (menu.type === "pdf") {
    return (
      <Pressable
        onPress={() => menu.url && Linking.openURL(menu.url)}
        className="flex-row items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 active:opacity-70"
      >
        <FileText size={20} color="#7A2342" />
        <Text className="flex-1 font-medium text-foreground">{menu.name}</Text>
        <ExternalLink size={14} color="#7A6A6E" />
      </Pressable>
    );
  }

  if (menu.type === "image") {
    return (
      <>
        <Pressable
          onPress={() => menu.url && setShowImage(true)}
          className="flex-row items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 active:opacity-70"
        >
          <List size={20} color="#7A2342" />
          <Text className="flex-1 font-medium text-foreground">{menu.name}</Text>
          <ExternalLink size={14} color="#7A6A6E" />
        </Pressable>

        <Modal visible={showImage} transparent animationType="fade" onRequestClose={() => setShowImage(false)}>
          <View className="flex-1 bg-black">
            <SafeAreaView edges={["top"]} className="px-4 pt-2">
              <Pressable onPress={() => setShowImage(false)} className="self-end rounded-full bg-white/20 p-2">
                <X size={22} color="#fff" />
              </Pressable>
            </SafeAreaView>
            <View className="flex-1 items-center justify-center">
              <Image
                source={{ uri: menu.url ?? "" }}
                style={{ width: "100%", height: "90%" }}
                resizeMode="contain"
              />
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // manual
  const items = [...(menu.menu_items ?? [])].sort((a, b) => a.position - b.position);
  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category ?? "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <>
      <Pressable
        onPress={() => setShowManual(true)}
        className="flex-row items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 active:opacity-70"
      >
        <List size={20} color="#7A2342" />
        <Text className="flex-1 font-medium text-foreground">{menu.name}</Text>
        <Text className="text-xs text-muted-foreground">{items.length} items</Text>
        <ExternalLink size={14} color="#7A6A6E" />
      </Pressable>

      <Modal visible={showManual} animationType="slide" onRequestClose={() => setShowManual(false)}>
        <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text className="text-lg font-bold text-foreground">{menu.name}</Text>
            <Pressable onPress={() => setShowManual(false)} className="rounded-full bg-secondary p-2">
              <X size={18} color="#5A1E32" />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-4 pb-8">
            {Object.entries(grouped).map(([cat, catItems]) => (
              <View key={cat} className="mb-6">
                <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {cat}
                </Text>
                {catItems.map((item, idx) => (
                  <View
                    key={item.id}
                    className={`flex-row items-start justify-between py-3 ${idx < catItems.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <View className="flex-1 pr-4">
                      <Text className="font-medium text-foreground">{item.name}</Text>
                      {item.description && (
                        <Text className="mt-0.5 text-sm text-muted-foreground">{item.description}</Text>
                      )}
                    </View>
                    {item.price !== null && (
                      <Text className="font-semibold text-primary">
                        ${Number(item.price).toFixed(2)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
