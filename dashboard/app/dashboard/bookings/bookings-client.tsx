"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, Clock, Filter, RefreshCw, Users, Wifi, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Booking, BookingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type RealtimeStatus = "connecting" | "live" | "error";

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
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  // IDs of bookings that arrived via realtime (cleared after 8 s)
  const [newBookingIds, setNewBookingIds] = useState<Set<string>>(new Set());
  const newIdTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const supabase = getBrowserSupabase();

  const markNew = useCallback((id: string) => {
    setNewBookingIds((cur) => new Set(cur).add(id));
    // clear existing timer if booking arrives twice
    const existing = newIdTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setNewBookingIds((cur) => {
        const next = new Set(cur);
        next.delete(id);
        return next;
      });
      newIdTimers.current.delete(id);
    }, 8000);
    newIdTimers.current.set(id, timer);
  }, []);

  // Realtime subscription on bookings for these restaurants
  useEffect(() => {
    if (!restaurantIds.length) return;
    setRealtimeStatus("connecting");

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
          const id =
            (payload.new as any)?.id ?? (payload.old as any)?.id;
          if (!id) return;

          if (payload.eventType === "DELETE") {
            setBookings((cur) => cur.filter((b) => b.id !== id));
            return;
          }

          // Re-fetch the affected row with full joins
          const { data } = await supabase
            .from("bookings")
            .select(
              "id, user_id, restaurant_id, booking_time, party_size, status, special_requests, confirmation_code, created_at, updated_at, user:profiles!bookings_user_id_fkey(id, full_name, email, phone_number), restaurant:restaurants(id, name)",
            )
            .eq("id", id)
            .maybeSingle();
          if (!data) return;

          const booking = data as unknown as Booking;
          const guestName = booking.user?.full_name ?? "Guest";

          setBookings((cur) => {
            const idx = cur.findIndex((b) => b.id === id);
            if (idx === -1) return [booking, ...cur];
            const next = cur.slice();
            next[idx] = booking;
            return next;
          });

          if (payload.eventType === "INSERT") {
            markNew(id);
            if (booking.status === "pending") {
              toast("New booking request", {
                description: `${guestName} · ${booking.party_size} guest${booking.party_size !== 1 ? "s" : ""} · ${format(new Date(booking.booking_time), "EEE d MMM 'at' h:mm a")}`,
                duration: 10000,
                action: {
                  label: "Review",
                  onClick: () => setActiveTab("pending"),
                },
              });
              // Play a brief audio ping using the Web Audio API (no file needed)
              try {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.6);
              } catch {
                // AudioContext may be blocked until user interaction — silent fail
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const oldStatus = (payload.old as any)?.status as BookingStatus | undefined;
            const newStatus = booking.status;
            if (oldStatus && oldStatus !== newStatus) {
              const msgs: Partial<Record<BookingStatus, { fn: typeof toast; text: string }>> = {
                confirmed: { fn: toast.success, text: `Booking confirmed for ${guestName}` },
                declined:  { fn: toast.warning, text: `You declined ${guestName}'s booking` },
                cancelled: { fn: toast.warning, text: `${guestName} cancelled their booking` },
                completed: { fn: toast.success, text: `${guestName}'s booking completed` },
              };
              const m = msgs[newStatus];
              if (m) m.fn(m.text);
            }
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          setRealtimeStatus("error");
        else setRealtimeStatus("connecting");
      });

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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Bookings</h1>
            {/* Realtime connection badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                realtimeStatus === "live" && "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
                realtimeStatus === "connecting" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
                realtimeStatus === "error" && "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
              )}
              title={
                realtimeStatus === "live"
                  ? "Real-time updates active"
                  : realtimeStatus === "connecting"
                  ? "Connecting to real-time..."
                  : "Real-time disconnected — refresh to reconnect"
              }
            >
              {realtimeStatus === "live" ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  Live
                </>
              ) : realtimeStatus === "connecting" ? (
                <>
                  <Wifi size={12} className="animate-pulse" />
                  Connecting
                </>
              ) : (
                <>
                  <WifiOff size={12} />
                  Offline
                </>
              )}
            </span>
          </div>
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
            <BookingRow key={b.id} booking={b} isNew={newBookingIds.has(b.id)} onSetStatus={setStatus} />
          ))
        )}
      </div>
    </div>
  );
}

function BookingRow({
  booking,
  isNew,
  onSetStatus,
}: {
  booking: Booking;
  isNew?: boolean;
  onSetStatus: (b: Booking, s: BookingStatus) => void;
}) {
  const dt = new Date(booking.booking_time);
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 transition-all duration-500",
        isNew
          ? "border-green-400 ring-2 ring-green-400/40 shadow-[0_0_0_4px_rgba(74,222,128,0.15)] animate-pulse-once"
          : "border-border",
      )}
    >
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
