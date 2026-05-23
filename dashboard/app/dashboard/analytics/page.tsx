import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  subDays,
  format,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";
import { RangeTabs } from "./range-tabs";
import { BookingStatus } from "@/lib/types";

const STATUS_CSS_VARS: Record<BookingStatus, string> = {
  pending:   "var(--color-warning)",
  confirmed: "var(--color-success)",
  completed: "var(--color-primary)",
  declined:  "var(--color-destructive)",
  cancelled: "var(--color-muted-foreground)",
};
const STATUS_LABELS: Record<BookingStatus, string> = {
  pending:   "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  declined:  "Declined",
  cancelled: "Cancelled",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = [7, 14, 30].includes(Number(daysParam)) ? Number(daysParam) : 14;

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
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-4 text-muted-foreground">
          Set up a restaurant in{" "}
          <a href="/dashboard/settings" className="text-primary underline">
            Settings
          </a>{" "}
          to see analytics.
        </p>
      </div>
    );
  }

  const restaurantIds = ownedRestaurants.map((r) => r.id);
  const since = startOfDay(subDays(new Date(), days - 1));

  const { data: bookings = [] } = await supabase
    .from("bookings")
    .select("id, status, party_size, booking_time, created_at")
    .in("restaurant_id", restaurantIds)
    .gte("created_at", since.toISOString())
    .order("booking_time", { ascending: true });

  const all = bookings ?? [];

  // ── Key stats ──────────────────────────────────────────────────────────────
  const total = all.length;
  const confirmed = all.filter((b) => b.status === "confirmed" || b.status === "completed").length;
  const cancelled = all.filter((b) => b.status === "cancelled" || b.status === "declined").length;
  const avgParty =
    total > 0
      ? (all.reduce((s, b) => s + (b.party_size ?? 0), 0) / total).toFixed(1)
      : "—";
  const confirmRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const cancelRate  = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  // ── Bookings by day ────────────────────────────────────────────────────────
  const dayRange = eachDayOfInterval({ start: since, end: endOfDay(new Date()) });
  const byDay = dayRange.map((d) => {
    const label = format(d, days <= 14 ? "MMM d" : "MMM d");
    const count = all.filter((b) => {
      const t = parseISO(b.booking_time);
      return t >= startOfDay(d) && t <= endOfDay(d);
    }).length;
    return { label, count };
  });
  const maxDay = Math.max(...byDay.map((d) => d.count), 1);

  // ── Status breakdown ───────────────────────────────────────────────────────
  const statuses: BookingStatus[] = ["confirmed", "completed", "pending", "cancelled", "declined"];
  const statusCounts = statuses.map((s) => ({
    status: s,
    count: all.filter((b) => b.status === s).length,
  }));

  // ── Peak hours (0-23) ──────────────────────────────────────────────────────
  const hourBuckets: number[] = Array(24).fill(0);
  all.forEach((b) => {
    const h = new Date(b.booking_time).getHours();
    hourBuckets[h]++;
  });
  const serviceHours = hourBuckets.slice(10, 24).map((count, i) => ({
    hour: i + 10,
    label: format(new Date().setHours(i + 10, 0), "ha"),
    count,
  }));
  const maxHour = Math.max(...serviceHours.map((h) => h.count), 1);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ownedRestaurants.map((r) => r.name).join(" · ")} — last {days} days
          </p>
        </div>
        <RangeTabs current={days} />
      </div>

      {/* ── Key stats ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Bookings" value={String(total)} />
        <StatCard
          label="Confirm Rate"
          value={`${confirmRate}%`}
          sub={`${confirmed} confirmed or completed`}
          color="text-success"
        />
        <StatCard
          label="Cancel / Decline"
          value={`${cancelRate}%`}
          sub={`${cancelled} bookings`}
          color={cancelRate > 20 ? "text-destructive" : "text-muted-foreground"}
        />
        <StatCard label="Avg Party Size" value={String(avgParty)} sub="guests per booking" />
      </div>

      {/* ── Bookings per day ──────────────────────────────────────────────── */}
      <Section title="Bookings per day">
        {total === 0 ? (
          <Empty />
        ) : (
          <div className="flex items-end gap-1.5 h-40 w-full overflow-x-auto pb-6 relative">
            {byDay.map(({ label, count }) => (
              <div key={label} className="flex flex-col items-center gap-1 flex-1 min-w-7">
                <span className="text-[10px] text-muted-foreground font-medium">{count || ""}</span>
                <div
                  className="w-full rounded-t-sm bg-primary transition-all"
                  style={{ height: `${Math.max((count / maxDay) * 96, count > 0 ? 4 : 0)}px` }}
                  title={`${label}: ${count}`}
                />
                <span
                  className="text-[9px] text-muted-foreground -rotate-45 origin-top-left mt-1 whitespace-nowrap"
                  style={{ writingMode: "horizontal-tb" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Status breakdown ──────────────────────────────────────────────── */}
      <Section title="Status breakdown">
        {total === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-3">
            {statusCounts.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className="w-24 text-sm text-muted-foreground shrink-0">
                  {STATUS_LABELS[status as BookingStatus]}
                </span>
                <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${total > 0 ? (count / total) * 100 : 0}%`,
                      backgroundColor: STATUS_CSS_VARS[status as BookingStatus],
                    }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold tabular-nums">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Peak hours ────────────────────────────────────────────────────── */}
      <Section title="Peak booking hours">
        {total === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {serviceHours.map(({ label, count, hour }) => (
              <div key={hour} className="flex items-center gap-3">
                <span className="w-10 text-sm text-muted-foreground font-mono shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-5 rounded bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded bg-primary/70 transition-all"
                    style={{ width: `${(count / maxHour) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">
                  {count || ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-4xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">
      No bookings in this period yet.
    </p>
  );
}
