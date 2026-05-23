// hooks/useOffers.ts — Supabase-backed
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase-generated";
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant: Restaurant;
  img_url?: string;
};

export interface EnrichedOffer extends SpecialOffer {
  claimed?: boolean;
  used?: boolean;
  redemptionCode?: string;
  claimedAt?: string;
  usedAt?: string;
  expiresAt?: string;
  isExpired?: boolean;
  canUse?: boolean;
  daysUntilExpiry?: number;
}

export interface UserOfferData {
  id: string;
  user_id: string;
  offer_id: string;
  claimed_at: string;
  used_at?: string;
  booking_id?: string;
  expires_at?: string;
  metadata?: any;
}

export interface OfferFilters {
  category: string;
  minDiscount: number;
  cuisineTypes: string[];
  sortBy: "discount" | "expiry" | "newest" | "popular";
  location?: { latitude: number; longitude: number };
  maxDistance?: number;
}

export const OFFER_CATEGORIES = [
  { id: "all", label: "All", icon: "Sparkles" },
  { id: "trending", label: "Trending", icon: "TrendingUp" },
  { id: "new", label: "New", icon: "Gift" },
  { id: "expiring", label: "Ending Soon", icon: "Clock" },
  { id: "claimed", label: "My Offers", icon: "Tag" },
  { id: "nearby", label: "Nearby", icon: "MapPin" },
];

const noop = async () => {};
const noopBool = async () => false;

function enrichOffer(offer: any): EnrichedOffer {
  const now = new Date();
  const validUntil = offer.valid_until ? new Date(offer.valid_until) : null;
  const isExpired = validUntil ? now > validUntil : false;
  const daysUntilExpiry = validUntil
    ? Math.max(0, Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : undefined;
  return {
    ...offer,
    claimed: false,
    used: false,
    isExpired,
    canUse: !isExpired && offer.is_active,
    daysUntilExpiry,
  };
}

export function useOffers() {
  const [offers, setOffers] = useState<EnrichedOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filters, setFilters] = useState<OfferFilters>({
    category: "all",
    minDiscount: 0,
    cuisineTypes: [],
    sortBy: "discount",
  });

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("special_offers")
        .select(`
          id, restaurant_id, title, description, discount_percentage,
          discount_type, valid_from, valid_until, is_active, created_at, updated_at,
          restaurant:restaurants(
            id, name, main_image_url, address, cuisine_type,
            average_rating, price_range, latitude, longitude
          )
        `)
        .eq("is_active", true)
        .order("discount_percentage", { ascending: false });

      if (err) throw err;
      setOffers((data ?? []).map(enrichOffer));
    } catch (e: any) {
      setError(e.message ?? "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const updateFilters = useCallback((newFilters: Partial<OfferFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const updateCategory = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);


  return {
    offers,
    userOffers: new Map<string, UserOfferData>(),
    selectedCategory,
    filters,
    loading,
    error,
    fetchOffers,
    claimOffer: noopBool,
    useOffer: noopBool,
    redeemOffer: noopBool,
    claimAndRedeemOffer: noopBool,
    releaseClaimedOffer: noopBool,
    updateFilters,
    updateCategory,
    getClaimedOffers: () => [] as EnrichedOffer[],
    getActiveOffers: () => offers.filter((o) => !o.isExpired && o.is_active),
    getUsedOffers: () => [] as EnrichedOffer[],
    getExpiredOffers: () => offers.filter((o) => o.isExpired),
    getOfferStats: () => ({
      total: offers.length,
      claimed: 0,
      active: offers.filter((o) => !o.isExpired).length,
      used: 0,
      expired: offers.filter((o) => o.isExpired).length,
      availableToRedeem: 0,
    }),
    canClaimOffer: (_offer: EnrichedOffer) => ({ canClaim: true, reason: null as string | null }),
    enrichOffer,
    expireOldOffers: noop,
    OFFER_CATEGORIES,
  };
}

