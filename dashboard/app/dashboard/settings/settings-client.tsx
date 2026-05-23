"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, MapPin, X, Upload, Link2, Loader2 } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Restaurant, RestaurantImage } from "@/lib/types";
import { MapPicker } from "@/components/map-picker";

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
  initialSecondaryImages = [],
}: {
  userId: string;
  restaurant: Restaurant | null;
  initialSecondaryImages?: RestaurantImage[];
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
      cuisine_types: [],
      price_range: 2,
      booking_policy: "request",
      min_party_size: 1,
      max_party_size: 10,
      main_image_url: "",
      phone_number: "",
    },
  );
  const [secondaryImages, setSecondaryImages] = useState<RestaurantImage[]>(initialSecondaryImages);
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
        <CuisinePicker
          main={r.cuisine_type ?? ""}
          others={r.cuisine_types ?? []}
          onMainChange={(v) => setR({ ...r, cuisine_type: v })}
          onOthersChange={(v) => setR({ ...r, cuisine_types: v })}
        />
        <Field
          label="Phone"
          value={r.phone_number ?? ""}
          onChange={(v) => setR({ ...r, phone_number: v })}
        />
        <ImageInput
          label="Main Image"
          value={r.main_image_url ?? ""}
          onChange={(v) => setR({ ...r, main_image_url: v })}
        />
        <SecondaryImagesInput
          restaurantId={restaurant?.id ?? null}
          images={secondaryImages}
          onChange={setSecondaryImages}
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
  const [showMap, setShowMap] = useState(false);
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

  const handleMapConfirm = (addr: string, lat: number, lng: number) => {
    setQuery(addr);
    setShowMap(false);
    onChange(addr, lat, lng);
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
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20"
          >
            <MapPin className="h-4 w-4" />
            Map
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

      {showMap && (
        <MapPicker
          initialLat={latitude}
          initialLng={longitude}
          initialAddress={query}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}

function ImageInput({
  label = "Restaurant Image",
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setUploading(true);
    try {
      const supabase = getBrowserSupabase();
      const ext = file.name.split(".").pop();
      const path = `restaurant-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("restaurant-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (error) throw error;

      const { data } = supabase.storage
        .from("restaurant-images")
        .getPublicUrl(path);

      onChange(data.publicUrl);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>

      {/* Preview */}
      {value && (
        <div className="mb-3 relative w-full h-40 rounded-lg overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Restaurant" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Mode toggle */}
      <div className="mb-2 flex rounded-lg border border-border overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2 ${mode === "url" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Link2 className="h-3.5 w-3.5" /> Enter URL
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2 ${mode === "upload" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          <Upload className="h-3.5 w-3.5" /> Upload File
        </button>
      </div>

      {mode === "url" ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      ) : (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-6 text-sm text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Click to select image (max 5 MB)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function SecondaryImagesInput({
  restaurantId,
  images,
  onChange,
}: {
  restaurantId: string | null;
  images: RestaurantImage[];
  onChange: (images: RestaurantImage[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    if (!restaurantId) {
      toast.error("Save the restaurant first before adding secondary images");
      return;
    }

    setUploading(true);
    const supabase = getBrowserSupabase();
    const uploaded: RestaurantImage[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5 MB — skipped`);
        continue;
      }
      const ext = file.name.split(".").pop();
      const path = `restaurant-images/${restaurantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("restaurant-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) { toast.error(`Upload failed: ${uploadError.message}`); continue; }

      const { data: urlData } = supabase.storage
        .from("restaurant-images")
        .getPublicUrl(path);

      const nextPosition = images.length + uploaded.length;
      const { data: row, error: insertError } = await supabase
        .from("restaurant_images")
        .insert({ restaurant_id: restaurantId, url: urlData.publicUrl, position: nextPosition })
        .select()
        .single();

      if (insertError) { toast.error(`DB save failed: ${insertError.message}`); continue; }
      uploaded.push(row as RestaurantImage);
    }

    if (uploaded.length) {
      onChange([...images, ...uploaded]);
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} added`);
    }
    setUploading(false);
  };

  const remove = async (img: RestaurantImage) => {
    const supabase = getBrowserSupabase();
    const { error } = await supabase
      .from("restaurant_images")
      .delete()
      .eq("id", img.id);
    if (error) { toast.error(error.message); return; }
    onChange(images.filter((i) => i.id !== img.id));
  };

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium">Secondary Images</span>
      <p className="mb-3 text-xs text-muted-foreground">
        These appear in the mobile carousel after the main image. Save the restaurant first before uploading.
      </p>

      {images.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((img, idx) => (
              <div key={img.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={`Secondary ${idx + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(img)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                  {idx + 1}
                </span>
              </div>
            ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || !restaurantId}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-5 text-sm text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
        ) : (
          <><Upload className="h-4 w-4" /> Add images (select multiple)</>
        )}
      </button>
    </div>
  );
}

function CuisinePicker({
  main,
  others,
  onMainChange,
  onOthersChange,
}: {
  main: string;
  others: string[];
  onMainChange: (v: string) => void;
  onOthersChange: (v: string[]) => void;
}) {
  const toggle = (c: string) => {
    if (c === main) return; // can't uncheck main via additional
    if (others.includes(c)) {
      onOthersChange(others.filter((x) => x !== c));
    } else {
      onOthersChange([...others, c]);
    }
  };

  const setMain = (v: string) => {
    onMainChange(v);
    // remove new main from additional list if it was there
    if (others.includes(v)) onOthersChange(others.filter((x) => x !== v));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Main cuisine</span>
          <select
            value={main}
            onChange={(e) => setMain(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2"
          >
            <option value="">Select cuisine…</option>
            {CUISINES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium">
            Additional cuisines
            <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
          </span>
          {/* Selected tags */}
          <div className="flex flex-wrap gap-1.5">
            {others.length === 0 && (
              <span className="text-xs text-muted-foreground">None selected</span>
            )}
            {others.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {c}
                <button type="button" onClick={() => toggle(c)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Cuisine grid checkboxes */}
      <div className="rounded-lg border border-border bg-secondary/30 p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Select additional cuisines your restaurant serves:
        </p>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
          {CUISINES.filter((c) => c !== main).map((c) => {
            const checked = others.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className={`rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  checked
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
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
