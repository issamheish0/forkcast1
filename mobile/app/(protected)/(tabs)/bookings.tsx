import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CalendarDays, Clock, Users } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Booking, BookingStatus } from "@/lib/types";
import { useAuth } from "@/context/auth-provider";

const STATUS_STYLE: Record<BookingStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: "#FEF9C3", text: "#854D0E", label: "Pending" },
  confirmed: { bg: "#DCFCE7", text: "#166534", label: "Confirmed" },
  declined: { bg: "#FEE2E2", text: "#991B1B", label: "Declined" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280", label: "Cancelled" },
  completed: { bg: "#EDE9FE", text: "#5B21B6", label: "Completed" },
};

type BookingWithRestaurant = Booking & {
  restaurant: { id: string; name: string; main_image_url: string | null } | null;
};

export default function BookingsTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<BookingWithRestaurant[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bookings")
      .select(
        "id, user_id, restaurant_id, booking_time, party_size, status, special_requests, confirmation_code, created_at, updated_at, restaurant:restaurants(id, name, main_image_url)",
      )
      .eq("user_id", user.id)
      .order("booking_time", { ascending: false })
      .limit(50);
    setBookings((data ?? []) as BookingWithRestaurant[]);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      {loading ? (
        <ActivityIndicator className="mt-12" />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => <BookingRow booking={item} />}
          ListEmptyComponent={
            <View className="mt-20 items-center gap-3">
              <CalendarDays size={48} color="#D5B4D5" />
              <Text className="text-lg font-semibold text-foreground">No bookings yet</Text>
              <Text className="text-center text-muted-foreground">
                Book a table to see your reservations here.
              </Text>
              <Pressable
                onPress={() => router.push("/(protected)/(tabs)")}
                className="mt-2 rounded-xl bg-primary px-5 py-3"
              >
                <Text className="font-semibold text-primary-foreground">Browse restaurants</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function BookingRow({ booking }: { booking: BookingWithRestaurant }) {
  const s = STATUS_STYLE[booking.status];
  const dt = new Date(booking.booking_time);

  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {booking.restaurant?.name ?? "Restaurant"}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-3">
            <View className="flex-row items-center gap-1">
              <CalendarDays size={14} color="#7A6A6E" />
              <Text className="text-sm text-muted-foreground">
                {dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Clock size={14} color="#7A6A6E" />
              <Text className="text-sm text-muted-foreground">
                {dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Users size={14} color="#7A6A6E" />
              <Text className="text-sm text-muted-foreground">
                {booking.party_size} {booking.party_size === 1 ? "guest" : "guests"}
              </Text>
            </View>
          </View>
          {booking.special_requests && (
            <Text className="mt-2 text-sm italic text-muted-foreground" numberOfLines={2}>
              "{booking.special_requests}"
            </Text>
          )}
          <Text className="mt-2 text-xs text-muted-foreground">
            Code: <Text className="font-mono">{booking.confirmation_code}</Text>
          </Text>
        </View>

        <View
          style={{ backgroundColor: s.bg }}
          className="rounded-full px-2 py-1"
        >
          <Text style={{ color: s.text }} className="text-xs font-semibold">
            {s.label}
          </Text>
        </View>
      </View>
    </View>
  );
}
