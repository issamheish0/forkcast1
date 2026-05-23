import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: ownedRestaurants } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", user.id);

  if (!ownedRestaurants?.length) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="mt-4 text-muted-foreground">
          Set up a restaurant in{" "}
          <a href="/dashboard/settings" className="text-primary underline">
            Settings
          </a>{" "}
          to see customer data.
        </p>
      </div>
    );
  }

  const restaurantIds = ownedRestaurants.map((r) => r.id);
  const restaurantMap = Object.fromEntries(ownedRestaurants.map((r) => [r.id, r.name]));

  // Fetch all bookings with user profiles — last 1000 entries is plenty for aggregation
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "user_id, restaurant_id, booking_time, party_size, status, user:profiles!bookings_user_id_fkey(id, full_name, email, phone_number)",
    )
    .in("restaurant_id", restaurantIds)
    .order("booking_time", { ascending: false })
    .limit(1000);

  // Aggregate per customer
  const customerMap = new Map<
    string,
    {
      id: string;
      full_name: string;
      email: string | null;
      phone_number: string | null;
      total_bookings: number;
      confirmed_bookings: number;
      total_covers: number;
      last_booking: string;
      restaurantIds: Set<string>;
    }
  >();

  for (const b of bookings ?? []) {
    const profile = b.user as {
      id: string;
      full_name: string;
      email: string | null;
      phone_number: string | null;
    } | null;
    if (!profile) continue;

    const existing = customerMap.get(profile.id);
    const isConfirmed = b.status === "confirmed" || b.status === "completed";

    if (existing) {
      existing.total_bookings += 1;
      if (isConfirmed) existing.confirmed_bookings += 1;
      existing.total_covers += b.party_size ?? 0;
      if (b.booking_time > existing.last_booking)
        existing.last_booking = b.booking_time;
      existing.restaurantIds.add(b.restaurant_id);
    } else {
      customerMap.set(profile.id, {
        id: profile.id,
        full_name: profile.full_name ?? "Unknown",
        email: profile.email,
        phone_number: profile.phone_number,
        total_bookings: 1,
        confirmed_bookings: isConfirmed ? 1 : 0,
        total_covers: b.party_size ?? 0,
        last_booking: b.booking_time,
        restaurantIds: new Set([b.restaurant_id]),
      });
    }
  }

  const customers = Array.from(customerMap.values()).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    email: c.email,
    phone_number: c.phone_number,
    total_bookings: c.total_bookings,
    confirmed_bookings: c.confirmed_bookings,
    total_covers: c.total_covers,
    last_booking: c.last_booking,
    restaurants: Array.from(c.restaurantIds)
      .map((id) => restaurantMap[id])
      .filter(Boolean),
  }));

  // Default sort: most bookings first (matches client default)
  customers.sort((a, b) => b.total_bookings - a.total_bookings);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {customers.length} unique guest{customers.length !== 1 ? "s" : ""} across{" "}
          {ownedRestaurants.map((r) => r.name).join(" · ")}
        </p>
      </div>
      <CustomersClient customers={customers} />
    </div>
  );
}
