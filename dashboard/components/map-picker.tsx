"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Search, X, Check, Loader2 } from "lucide-react";

type LResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

interface MapPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string;
  onConfirm: (address: string, lat: number, lng: number) => void;
  onClose: () => void;
}

export function MapPicker({
  initialLat,
  initialLng,
  initialAddress = "",
  onConfirm,
  onClose,
}: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const [query, setQuery] = useState(initialAddress);
  const [results, setResults] = useState<LResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentLat, setCurrentLat] = useState<number>(initialLat ?? 25.2048);
  const [currentLng, setCurrentLng] = useState<number>(initialLng ?? 55.2708);
  const [currentAddress, setCurrentAddress] = useState(initialAddress);
  const [geocoding, setGeocoding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reverse geocode coordinates to an address
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { "Accept-Language": "en" } },
      );
      const data = await res.json();
      const address = data.display_name
        ? data.display_name.split(",").slice(0, 4).join(",").trim()
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setCurrentAddress(address);
      setQuery(address);
    } catch {
      setCurrentAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setGeocoding(false);
    }
  }, []);

  // Initialise Leaflet map (runs once in browser only)
  useEffect(() => {
    if (!mapRef.current) return;

    // Inject Leaflet CSS once
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let map: any;
    let marker: any;

    import("leaflet").then((L: any) => {
      leafletRef.current = L;

      // Fix default icon paths broken by bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      map = L.map(mapRef.current!, { zoomControl: true }).setView(
        [currentLat, currentLng],
        14,
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      marker = L.marker([currentLat, currentLng], { draggable: true }).addTo(map);
      markerRef.current = marker;
      mapInstanceRef.current = map;

      // Click on map → move marker
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setCurrentLat(lat);
        setCurrentLng(lng);
        reverseGeocode(lat, lng);
      });

      // Drag marker → update coordinates
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setCurrentLat(pos.lat);
        setCurrentLng(pos.lng);
        reverseGeocode(pos.lat, pos.lng);
      });
    });

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flyTo = (lat: number, lng: number) => {
    setCurrentLat(lat);
    setCurrentLng(lng);
    markerRef.current?.setLatLng([lat, lng]);
    mapInstanceRef.current?.flyTo([lat, lng], 16);
  };

  const searchAddresses = async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { "Accept-Language": "en" } },
      );
      const data: LResult[] = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleQueryChange = (v: string) => {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddresses(v), 500);
  };

  const pickResult = (item: LResult) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const address = item.display_name.split(",").slice(0, 4).join(",").trim();
    setQuery(address);
    setCurrentAddress(address);
    setResults([]);
    setCurrentLat(lat);
    setCurrentLng(lng);
    flyTo(lat, lng);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-xl bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Pick Location on Map</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="relative border-b border-border px-3 py-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search address…"
                className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => searchAddresses(query)}
              disabled={searching}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </button>
          </div>

          {/* Dropdown results */}
          {results.length > 0 && (
            <div className="absolute left-3 right-3 z-10 mt-1 rounded-lg border border-border bg-card shadow-lg">
              {results.map((item) => (
                <button
                  key={item.place_id}
                  type="button"
                  onClick={() => pickResult(item)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.display_name}</span>
                </button>
              ))}
              <button
                onClick={() => setResults([])}
                className="flex w-full items-center justify-center gap-1 border-t border-border py-2 text-xs text-muted-foreground hover:bg-secondary"
              >
                <X className="h-3 w-3" /> Close
              </button>
            </div>
          )}
        </div>

        {/* Map */}
        <div ref={mapRef} className="h-80 w-full" />

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            {geocoding ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Detecting address…
              </span>
            ) : (
              <span className="truncate max-w-xs">
                {currentAddress || `${currentLat.toFixed(5)}, ${currentLng.toFixed(5)}`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(currentAddress, currentLat, currentLng)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Check className="h-4 w-4" />
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
