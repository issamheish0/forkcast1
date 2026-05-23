import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { BookingsClient } from "./bookings-client";

export default async function BookingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Find the restaurants this user manages
  const { data: ownedRestaurants } = await supabase
    .from("restaurants")
    .select("id, name, booking_policy")
    .eq("owner_id", user.id);

  if (!ownedRestaurants || ownedRestaurants.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Bookings</h1>
        <p className="mt-4 text-muted-foreground">
          You don't manage any restaurant yet. Set one up in{" "}
          <a href="/dashboard/settings" className="text-primary underline">
            Settings
          </a>
          .
        </p>
      </div>
    );
  }

  const restaurantIds = ownedRestaurants.map((r) => r.id);

  // Initial load — most recent 100 bookings across managed restaurants
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, user_id, restaurant_id, booking_time, party_size, status, special_requests, confirmation_code, created_at, updated_at, user:profiles!bookings_user_id_fkey(id, full_name, email, phone_number), restaurant:restaurants(id, name)",
    )
    .in("restaurant_id", restaurantIds)
    .order("booking_time", { ascending: false })
    .limit(100);

  return (
    <BookingsClient
      restaurantIds={restaurantIds}
      restaurants={ownedRestaurants}
      initialBookings={(bookings ?? []) as any}
    />
  );
}
