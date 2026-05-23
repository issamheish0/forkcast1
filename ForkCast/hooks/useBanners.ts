// hooks/useBanners.ts — MOCK STUB (no Supabase calls)
import { EnrichedBanner } from "@/types/banners";

export function useBanners() {
  return {
    banners: [] as EnrichedBanner[],
    loading: false,
    error: null as string | null,
    refetch: async () => {},
  };
}
