"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, MapPin, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Restaurant } from "@/lib/types";

const CUISINES = [
  "American",
  "Chinese",
  "French",
  "Greek",
  "Indian",
  "Italian",
  "Japanese",
  "Korean",
  "Lebanese",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Moroccan",
  "Persian",
  "Pizza",
  "Seafood",
  "Steakhouse",
  "Sushi",
  "Thai",
  "Turkish",
  "Vietnamese",
  "Other",
] as const;

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

export function SettingsClient({
  userId,
  restaurant,
}: {
  userId: string;
  restaurant: Restaurant | null;
}) {
  const router = useRouter();
  const [r, setR] = useState<Partial<Restaurant>>(
    restaurant ?? {
      name: "",
      description: "",
      address: "",
      latitude: null,
      longitude: null,
      cuisine_type: "",
      price_range: 2,
      booking_policy: "request",
      min_party_size: 1,
      max_party_size: 10,
      main_image_url: "",
      phone_number: "",
    },
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const supabase = getBrowserSupabase();
    if (restaurant) {
      const { error } = await supabase
        .from("restaurants")
        .update(r)
        .eq("id", restaurant.id);
      setSaving(false);
      if (error) toast.error(error.message);
      else toast.success("Saved");
    } else {
      const { error } = await supabase
        .from("restaurants")
        .insert({ ...r, owner_id: userId, name: r.name ?? "My Restaurant" });
      setSaving(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Restaurant created");
        router.refresh();
      }
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your restaurant profile and booking policy.
      </p>

      <div className="mt-8 grid max-w-3xl gap-4">
        <Field
          label="Name"
          value={r.name ?? ""}
          onChange={(v) => setR({ ...r, name: v })}
        />
        <Field
          label="Description"
          value={r.description ?? ""}
          onChange={(v) => setR({ ...r, description: v })}
          textarea
        />
        <AddressPicker
          address={r.address ?? ""}
          latitude={r.latitude ?? null}
          longitude={r.longitude ?? null}
          onChange={(address, lat, lon) =>
            setR({ ...r, address, latitude: lat, longitude: lon })
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Cuisine</span>
            <select
              value={r.cuisine_type ?? ""}
              onChange={(e) => setR({ ...r, cuisine_type: e.target.value })}
              className="w-full rounded-lg border border-border bg-card px-3 py-2"
            >
              <option value="">Select cuisine…</option>
              {CUISINES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Phone"
            value={r.phone_number ?? ""}
            onChange={(v) => setR({ ...r, phone_number: v })}
          />
        </div>
        <Field
          label="Main image URL"
          value={r.main_image_url ?? ""}
          onChange={(v) => setR({ ...r, main_image_url: v })}
        />
        <div className="grid grid-cols-3 gap-4">
          <NumberField
            label="Price range (1–4)"
            value={r.price_range ?? 2}
            onChange={(v) => setR({ ...r, price_range: v })}
          />
          <NumberField
            label="Min party"
            value={r.min_party_size ?? 1}
            onChange={(v) => setR({ ...r, min_party_size: v })}
          />
          <NumberField
            label="Max party"
            value={r.max_party_size ?? 10}
            onChange={(v) => setR({ ...r, max_party_size: v })}
          />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Booking policy</span>
          <select
            value={r.booking_policy ?? "request"}
            onChange={(e) =>
              setR({ ...r, booking_policy: e.target.value as "instant" | "request" })
            }
            className="w-full rounded-lg border border-border bg-card px-3 py-2"
          >
            <option value="request">Request — I'll review each booking</option>
            <option value="instant">Instant — auto-confirm bookings</option>
          </select>
        </label>

        <button
          onClick={save}
          disabled={saving}
          className="mt-4 self-start rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : restaurant ? "Save changes" : "Create restaurant"}
        </button>
      </div>
    </div>
  );
}

function AddressPicker({
  address,
  latitude,
  longitude,
  onChange,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (address: string, lat: number, lon: number) => void;
}) {
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { "Accept-Language": "en" } },
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(true);
    } catch {
      toast.error("Address lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (v: string) => {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 500);
  };

  const pick = (item: NominatimResult) => {
    const short = item.display_name.split(",").slice(0, 3).join(",").trim();
    setQuery(short);
    setResults([]);
    setOpen(false);
    onChange(short, parseFloat(item.lat), parseFloat(item.lon));
  };

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium">Address</span>
      <div className="relative">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Type an address to search…"
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2"
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          <button
            type="button"
            onClick={() => search(query)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {open && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
            {results.map((item) => (
              <button
                key={item.place_id}
                type="button"
                onClick={() => pick(item)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{item.display_name}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" /> Close
            </button>
          </div>
        )}
      </div>

      {latitude !== null && longitude !== null && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {latitude.toFixed(5)}, {longitude.toFixed(5)} — coordinates saved
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-card px-3 py-2"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2"
        />
      )}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-card px-3 py-2"
      />
    </label>
  );
}
