"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Wifi, WifiOff } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Booking, BookingStatus } from "@/lib/types";

type Counts = { pending: number; confirmed: number; today: number };
type RealtimeStatus = "connecting" | "live" | "error";

function getStatusStyle(status: BookingStatus): React.CSSProperties {
  const map: Record<BookingStatus, { bg: string; fg: string }> = {
    pending:   { bg: "var(--color-warning)",          fg: "var(--color-warning)" },
    confirmed: { bg: "var(--color-success)",          fg: "var(--color-success)" },
    completed: { bg: "var(--color-primary)",          fg: "var(--color-primary)" },
    declined:  { bg: "var(--color-destructive)",      fg: "var(--color-destructive)" },
    cancelled: { bg: "var(--color-muted-foreground)", fg: "var(--color-muted-foreground)" },
  };
  const { bg, fg } = map[status] ?? map.cancelled;
  return { backgroundColor: `color-mix(in srgb, ${bg} 15%, transparent)`, color: fg };
}

export function OverviewClient({
  restaurantIds,
  initialCounts,
  initialRecent,
}: {
  restaurantIds: string[];
  initialCounts: Counts;
  initialRecent: Booking[];
}) {
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [recent, setRecent] = useState<Booking[]>(initialRecent);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const supabase = getBrowserSupabase();

  const refetch = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [pending, confirmed, today, recentData] = await Promise.all([
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

    setCounts({
      pending:   pending.count   ?? 0,
      confirmed: confirmed.count ?? 0,
      today:     today.count     ?? 0,
    });
    setRecent((recentData.data ?? []) as Booking[]);
    setLastUpdated(new Date());
  }, [restaurantIds, supabase]);

  useEffect(() => {
    if (!restaurantIds.length) return;

    const channel = supabase
      .channel("overview-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `restaurant_id=in.(${restaurantIds.join(",")})`,
        },
        () => { refetch(); },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setRealtimeStatus("error");
        else setRealtimeStatus("connecting");
      });

    return () => { supabase.removeChannel(channel); };
  }, [restaurantIds, supabase, refetch]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="mt-1 text-muted-foreground">Your bookings at a glance.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {realtimeStatus === "live" ? (
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live
            </span>
          ) : realtimeStatus === "connecting" ? (
            <span className="flex items-center gap-1.5 text-xs text-warning">
              <Wifi className="h-3.5 w-3.5" /> Connecting
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <WifiOff className="h-3.5 w-3.5" /> Offline
            </span>
          )}
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {format(lastUpdated, "HH:mm:ss")}
            </span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending"   value={counts.pending}   accent="warning" />
        <StatCard label="Confirmed" value={counts.confirmed} accent="success" />
        <StatCard label="Today"     value={counts.today}     accent="primary" />
      </div>

      {/* Recent bookings */}
      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold">Recent bookings</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
            {recent.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {(b.user as any)?.full_name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(b.booking_time), "MMM d, h:mm a")} ·{" "}
                    {b.party_size} {b.party_size === 1 ? "guest" : "guests"}
                  </p>
                </div>
                <span
                  style={getStatusStyle(b.status)}
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                >
                  {b.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

function StatCard({
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
      <p className={`mt-2 text-4xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
