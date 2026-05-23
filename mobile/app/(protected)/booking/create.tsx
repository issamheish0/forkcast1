import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Minus, Plus } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Restaurant } from "@/lib/types";
import { useAuth } from "@/context/auth-provider";

// Generate next 14 day options
function nextDays(n: number) {
  const out: { label: string; date: Date }[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      label: d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      date: d,
    });
  }
  return out;
}

const TIME_SLOTS = [
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

export default function BookingCreate() {
  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [dayIdx, setDayIdx] = useState(0);
  const [time, setTime] = useState("20:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = nextDays(14);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .maybeSingle();
      setRestaurant(data as Restaurant);
    })();
  }, [restaurantId]);

  const submit = async () => {
    if (!user || !restaurant) return;
    setError(null);
    setSubmitting(true);
    const date = days[dayIdx].date;
    const [h, m] = time.split(":").map(Number);
    const bookingTime = new Date(date);
    bookingTime.setHours(h, m, 0, 0);

    const initialStatus =
      restaurant.booking_policy === "instant" ? "confirmed" : "pending";

    const { data, error: insertError } = await supabase
      .from("bookings")
      .insert({
        restaurant_id: restaurant.id,
        user_id: user.id,
        booking_time: bookingTime.toISOString(),
        party_size: partySize,
        status: initialStatus,
        special_requests: notes.trim() || null,
      })
      .select("id, confirmation_code, status")
      .single();

    setSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create booking.");
      return;
    }

    router.replace({
      pathname: "/(protected)/booking/success",
      params: {
        code: data.confirmation_code,
        status: data.status,
        restaurantName: restaurant.name,
      },
    });
  };

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 p-4">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
        >
          <ArrowLeft size={20} color="#5A1E32" />
        </Pressable>
        <Text className="text-xl font-bold text-foreground">Book a table</Text>
      </View>

      <ScrollView contentContainerClassName="px-6 pb-32">
        <View className="rounded-2xl bg-card border border-border p-4">
          <Text className="text-base font-semibold text-foreground">{restaurant.name}</Text>
          <Text className="text-sm text-muted-foreground">{restaurant.address}</Text>
        </View>

        <Section title="Party size">
          <View className="flex-row items-center justify-center gap-6 rounded-2xl bg-card border border-border p-4">
            <Pressable
              onPress={() =>
                setPartySize(Math.max(restaurant.min_party_size, partySize - 1))
              }
              className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
            >
              <Minus size={18} color="#5A1E32" />
            </Pressable>
            <Text className="w-12 text-center text-2xl font-bold text-foreground">
              {partySize}
            </Text>
            <Pressable
              onPress={() =>
                setPartySize(Math.min(restaurant.max_party_size, partySize + 1))
              }
              className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
            >
              <Plus size={18} color="#5A1E32" />
            </Pressable>
          </View>
        </Section>

        <Section title="Date">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {days.map((d, i) => (
              <Pressable
                key={d.label}
                onPress={() => setDayIdx(i)}
                className={`rounded-xl px-4 py-3 ${
                  i === dayIdx ? "bg-primary" : "bg-card border border-border"
                }`}
              >
                <Text
                  className={
                    i === dayIdx
                      ? "text-primary-foreground font-semibold"
                      : "text-foreground"
                  }
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Section>

        <Section title="Time">
          <View className="flex-row flex-wrap gap-2">
            {TIME_SLOTS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTime(t)}
                className={`rounded-xl px-4 py-3 ${
                  t === time ? "bg-primary" : "bg-card border border-border"
                }`}
              >
                <Text
                  className={
                    t === time
                      ? "text-primary-foreground font-semibold"
                      : "text-foreground"
                  }
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Special requests (optional)">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Allergies, occasion, seating preferences..."
            multiline
            className="min-h-[100px] rounded-2xl border border-border bg-card p-4 text-foreground"
          />
        </Section>

        {error && <Text className="mt-4 text-destructive">{error}</Text>}
      </ScrollView>

      <SafeAreaView
        edges={["bottom"]}
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-6 pt-3"
      >
        <Pressable
          onPress={submit}
          disabled={submitting}
          className="items-center rounded-2xl bg-primary py-4"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              {restaurant.booking_policy === "instant"
                ? "Confirm booking"
                : "Request booking"}
            </Text>
          )}
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}
