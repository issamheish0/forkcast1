"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Clock, Filter, RefreshCw, Users, X } from "lucide-react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Booking, BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { key: BookingStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "declined", label: "Declined" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export function BookingsClient({
  restaurantIds,
  restaurants,
  initialBookings,
}: {
  restaurantIds: string[];
  restaurants: { id: string; name: string }[];
  initialBookings: Booking[];
}) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [activeTab, setActiveTab] = useState<BookingStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const supabase = getBrowserSupabase();

  // Realtime subscription on bookings for these restaurants
  useEffect(() => {
    if (!restaurantIds.length) return;
    const channel = supabase
      .channel("dashboard-bookings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `restaurant_id=in.(${restaurantIds.join(",")})`,
        },
        async (payload) => {
          // Re-fetch the affected row with joins
          const id =
            (payload.new as any)?.id ?? (payload.old as any)?.id;
          if (!id) return;

          if (payload.eventType === "DELETE") {
            setBookings((cur) => cur.filter((b) => b.id !== id));
            return;
          }

          const { data } = await supabase
            .from("bookings")
            .select(
              "id, user_id, restaurant_id, booking_time, party_size, status, special_requests, confirmation_code, created_at, updated_at, user:profiles!bookings_user_id_fkey(id, full_name, email, phone_number), restaurant:restaurants(id, name)",
            )
            .eq("id", id)
            .maybeSingle();
          if (!data) return;

          setBookings((cur) => {
            const idx = cur.findIndex((b) => b.id === id);
            if (idx === -1) return [data as any, ...cur];
            const next = cur.slice();
            next[idx] = data as any;
            return next;
          });

          if (payload.eventType === "INSERT") {
            toast.info(`New booking from ${(data as any).user?.full_name ?? "guest"}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIds.join(",")]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length };
    for (const b of bookings) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (activeTab !== "all" && b.status !== activeTab) return false;
      if (!q) return true;
      return (
        b.user?.full_name?.toLowerCase().includes(q) ||
        b.user?.email?.toLowerCase().includes(q) ||
        b.confirmation_code.toLowerCase().includes(q)
      );
    });
  }, [bookings, activeTab, search]);

  const refresh = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from("bookings")
      .select(
        "id, user_id, restaurant_id, booking_time, party_size, status, special_requests, confirmation_code, created_at, updated_at, user:profiles!bookings_user_id_fkey(id, full_name, email, phone_number), restaurant:restaurants(id, name)",
      )
      .in("restaurant_id", restaurantIds)
      .order("booking_time", { ascending: false })
      .limit(100);
    if (data) setBookings(data as any);
    setRefreshing(false);
  };

  const setStatus = async (booking: Booking, status: BookingStatus) => {
    const prev = booking.status;
    setBookings((cur) =>
      cur.map((b) => (b.id === booking.id ? { ...b, status } : b)),
    );
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", booking.id);
    if (error) {
      setBookings((cur) =>
        cur.map((b) => (b.id === booking.id ? { ...b, status: prev } : b)),
      );
      toast.error(error.message);
      return;
    }
    toast.success(`Booking ${status}`);
  };

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {restaurants.map((r) => r.name).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, code..."
              className="w-72 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-secondary"
          >
            <RefreshCw
              size={14}
              className={cn(refreshing && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
              {counts[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No bookings here.
          </div>
        ) : (
          filtered.map((b) => (
            <BookingRow key={b.id} booking={b} onSetStatus={setStatus} />
          ))
        )}
      </div>
    </div>
  );
}

function BookingRow({
  booking,
  onSetStatus,
}: {
  booking: Booking;
  onSetStatus: (b: Booking, s: BookingStatus) => void;
}) {
  const dt = new Date(booking.booking_time);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">
              {booking.user?.full_name ?? "Guest"}
            </span>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {booking.user?.email ?? "—"}
            {booking.user?.phone_number ? ` · ${booking.user.phone_number}` : ""}
          </p>
          <p className="mt-2 text-sm text-foreground">
            <Clock className="-mt-0.5 mr-1 inline" size={14} />
            {format(dt, "EEE, MMM d 'at' h:mm a")}
            <span className="mx-2 text-muted-foreground">·</span>
            <Users className="-mt-0.5 mr-1 inline" size={14} />
            {booking.party_size}{" "}
            {booking.party_size === 1 ? "guest" : "guests"}
          </p>
          {booking.special_requests && (
            <p className="mt-2 max-w-xl text-sm italic text-muted-foreground">
              “{booking.special_requests}”
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Code: <span className="font-mono">{booking.confirmation_code}</span>
          </p>
        </div>

        <div className="flex gap-2">
          {booking.status === "pending" && (
            <>
              <button
                onClick={() => onSetStatus(booking, "confirmed")}
                className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                <Check size={14} /> Accept
              </button>
              <button
                onClick={() => onSetStatus(booking, "declined")}
                className="inline-flex items-center gap-1 rounded-lg border border-destructive px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive hover:text-white"
              >
                <X size={14} /> Decline
              </button>
            </>
          )}
          {booking.status === "confirmed" && (
            <button
              onClick={() => onSetStatus(booking, "completed")}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              Mark completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, string> = {
    pending: "bg-warning/20 text-warning",
    confirmed: "bg-success/20 text-success",
    completed: "bg-secondary text-secondary-foreground",
    declined: "bg-destructive/20 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        map[status],
      )}
    >
      {status}
    </span>
  );
}
