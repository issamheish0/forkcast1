import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

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

  let pendingCount = 0;
  let confirmedCount = 0;
  let todayCount = 0;

  if (restaurantIds.length) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [pending, confirmed, today] = await Promise.all([
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
    ]);

    pendingCount = pending.count ?? 0;
    confirmedCount = confirmed.count ?? 0;
    todayCount = today.count ?? 0;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Overview</h1>
      <p className="mt-1 text-muted-foreground">Your bookings at a glance.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Pending" value={pendingCount} accent="warning" />
        <Stat label="Confirmed" value={confirmedCount} accent="success" />
        <Stat label="Today" value={todayCount} accent="primary" />
      </div>

      <div className="mt-8">
        <Link
          href="/dashboard/bookings"
          className="inline-block rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90"
        >
          Manage bookings →
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "primary" | "success" | "warning";
}) {
  const color =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning"
        : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-4xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
