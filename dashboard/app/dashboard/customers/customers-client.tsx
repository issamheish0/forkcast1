"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Search, ArrowUpDown, User } from "lucide-react";

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  total_bookings: number;
  confirmed_bookings: number;
  total_covers: number;
  last_booking: string;
  restaurants: string[];
};

type SortKey = "total_bookings" | "last_booking" | "full_name";

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("total_bookings");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = customers.filter(
      (c) =>
        !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone_number?.includes(q),
    );
    result = result.slice().sort((a, b) => {
      let diff = 0;
      if (sort === "total_bookings") diff = a.total_bookings - b.total_bookings;
      else if (sort === "last_booking")
        diff = a.last_booking.localeCompare(b.last_booking);
      else diff = a.full_name.localeCompare(b.full_name);
      return sortAsc ? diff : -diff;
    });
    return result;
  }, [customers, search, sort, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sort === key) setSortAsc((v) => !v);
    else {
      setSort(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Sort:</span>
          {(
            [
              { key: "total_bookings", label: "Visits" },
              { key: "last_booking", label: "Last visit" },
              { key: "full_name", label: "Name" },
            ] as { key: SortKey; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                sort === key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card hover:bg-secondary"
              }`}
            >
              {label}
              {sort === key && (
                <ArrowUpDown className="h-3 w-3 opacity-70" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
        {search ? ` matching "${search}"` : ""}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <User className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No customers found.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Customer</span>
            <span className="text-right">Visits</span>
            <span className="text-right">Covers</span>
            <span className="text-right">Confirmed</span>
            <span className="text-right">Last visit</span>
          </div>

          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-1 md:gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors"
              >
                {/* Identity */}
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{c.full_name}</p>
                  {c.email && (
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  )}
                  {c.phone_number && (
                    <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                  )}
                  {c.restaurants.length > 0 && (
                    <p className="mt-1 truncate text-xs text-primary/80">
                      {c.restaurants.join(" · ")}
                    </p>
                  )}
                </div>

                {/* Stats — inline labels on mobile */}
                <Stat label="Visits" value={String(c.total_bookings)} />
                <Stat label="Covers" value={String(c.total_covers)} />
                <Stat
                  label="Confirmed"
                  value={`${c.total_bookings > 0 ? Math.round((c.confirmed_bookings / c.total_bookings) * 100) : 0}%`}
                />
                <Stat
                  label="Last visit"
                  value={format(parseISO(c.last_booking), "MMM d, yyyy")}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between md:block">
      <span className="text-xs text-muted-foreground md:hidden">{label}</span>
      <span className="text-sm font-semibold tabular-nums md:text-right md:block">{value}</span>
    </div>
  );
}
