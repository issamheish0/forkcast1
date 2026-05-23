import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { OverviewClient } from "./overview-client";

export default async function DashboardOverview() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id);
  const restaurantIds = (restaurants ?? []).map((r) => r.id);

  if (!restaurantIds.length) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Overview</h1>
        <p className="mt-4 text-muted-foreground">
          Set up a restaurant in{" "}
          <a href="/dashboard/settings" className="text-primary underline">
            Settings
          </a>{" "}
          to see your overview.
        </p>
      </div>
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [pending, confirmed, today, recent] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("restaurant_id", restaurantIds)
      .eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("restaurant_id", restaurantIds)
      .eq("status", "confirmed"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("restaurant_id", restaurantIds)
      .gte("booking_time", startOfDay.toISOString())
      .lte("booking_time", endOfDay.toISOString()),
    supabase
      .from("bookings")
      .select(
        "id, user_id, restaurant_id, booking_time, party_size, status, confirmation_code, created_at, updated_at, special_requests, user:profiles!bookings_user_id_fkey(id, full_name, email, phone_number), restaurant:restaurants(id, name)",
      )
      .in("restaurant_id", restaurantIds)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <OverviewClient
      restaurantIds={restaurantIds}
      initialCounts={{
        pending:   pending.count   ?? 0,
        confirmed: confirmed.count ?? 0,
        today:     today.count     ?? 0,
      }}
      initialRecent={(recent.data ?? []) as any}
    />
  );
}
