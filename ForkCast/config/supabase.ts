import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

// Read from environment variables (set via .env or eas.json build profiles)
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

class SecureStorage {
  private memoryFallback: Map<string, string> = new Map();
  private hasSecureStoreAccess: boolean | null = null;

  private async checkSecureStoreAccess(): Promise<boolean> {
    if (this.hasSecureStoreAccess !== null) {
      return this.hasSecureStoreAccess;
    }

    try {
      return true;
    } catch (error) {
      console.warn(
        "⚠️ SecureStore not available, using memory fallback:",
        error,
      );
      this.hasSecureStoreAccess = false;
      return false;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const hasAccess = await this.checkSecureStoreAccess();
      if (hasAccess) {
        const item = await SecureStore.getItemAsync(key);
        return item;
      } else {
        return this.memoryFallback.get(key) || null;
      }
    } catch (error) {
      console.warn(
        "SecureStorage getItem error, using memory fallback:",
        error,
      );
      return this.memoryFallback.get(key) || null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const hasAccess = await this.checkSecureStoreAccess();
      if (hasAccess) {
        await SecureStore.setItemAsync(key, value);
      }
      // Always store in memory as backup
      this.memoryFallback.set(key, value);
    } catch (error) {
      console.warn(
        "SecureStorage setItem error, using memory fallback:",
        error,
      );
      this.memoryFallback.set(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const hasAccess = await this.checkSecureStoreAccess();
      if (hasAccess) {
        await SecureStore.deleteItemAsync(key);
      }
      this.memoryFallback.delete(key);
    } catch (error) {
      console.warn("SecureStorage removeItem error:", error);
      this.memoryFallback.delete(key);
    }
  }
}

// ETag cache for HTTP conditional requests
const etagCache = new Map<
  string,
  { etag: string; body: any; timestamp: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Custom fetch wrapper with ETag caching + network metering
const createCachedFetch = () => {
  const originalFetch = globalThis.fetch;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : String(input);

    // Check if this is an edge function call
    const isEdgeFunction = url.includes("/functions/v1/");

    // Log edge function calls for debugging
    if (isEdgeFunction) {
    }

    // Only cache GET requests to Supabase REST API (NOT edge functions)
    const isGetRequest = !init?.method || init.method === "GET";
    const isSupabaseApi = url.includes("/rest/v1/") || url.includes("/rpc/");
    const shouldCache = isGetRequest && isSupabaseApi && !isEdgeFunction;

    // Add If-None-Match header if we have cached ETag
    const headers = new Headers(init?.headers || {});
    if (shouldCache) {
      const cached = etagCache.get(url);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        headers.set("If-None-Match", cached.etag);
      }
    }

    // Make request
    const res = await originalFetch(input, {
      ...init,
      headers,
    });

    // Log edge function responses for debugging
    if (isEdgeFunction) {
    }

    // Handle 304 Not Modified (cache hit)
    if (res.status === 304 && shouldCache) {
      const cached = etagCache.get(url);
      if (cached) {
        // Record cache hit (0 bytes transferred)
        try {
          const { networkMeter } = await import("@/utils/networkMeter");
          networkMeter.record({
            url,
            bytes: 0,
            method: "GET",
            fromCache: true,
          });
        } catch {}

        // Return cached response - Supabase will parse this correctly
        return new Response(JSON.stringify(cached.body), {
          status: 200,
          statusText: "OK",
          headers: new Headers({
            "content-type": "application/json",
            ...Object.fromEntries(res.headers.entries()),
          }),
        });
      }
    }

    // Cache successful GET responses (async, non-blocking)
    if (res.ok && shouldCache && res.status === 200) {
      const etag = res.headers.get("etag");
      if (etag) {
        // Cache response body in background (don't block main response)
        res
          .clone()
          .json()
          .then((body) => {
            etagCache.set(url, {
              etag,
              body,
              timestamp: Date.now(),
            });

            // Clean up old cache entries (keep last 100)
            if (etagCache.size > 100) {
              const entries = Array.from(etagCache.entries())
                .sort((a, b) => b[1].timestamp - a[1].timestamp)
                .slice(0, 100);
              etagCache.clear();
              entries.forEach(([k, v]) => etagCache.set(k, v));
            }
          })
          .catch(() => {
            // Ignore JSON parse errors
          });
      }
    }

    // Measure response size (network metering)
    try {
      const lenHeader = res.headers?.get?.("content-length");
      if (lenHeader) {
        const respBytes = parseInt(lenHeader, 10) || 0;
        if (respBytes > 0) {
          // Lazy import to avoid circular deps
          import("@/utils/networkMeter")
            .then(({ networkMeter }) => {
              networkMeter.record({
                url,
                bytes: respBytes,
                method: init?.method || "GET",
              });
            })
            .catch(() => {});
        }
      } else {
        // Fallback: measure body size async (non-blocking)
        const clone = res.clone();
        clone
          .arrayBuffer()
          .then((buf) => {
            const size = buf.byteLength;
            if (size > 0) {
              import("@/utils/networkMeter")
                .then(({ networkMeter }) => {
                  networkMeter.record({
                    url,
                    bytes: size,
                    method: init?.method || "GET",
                  });
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore metering errors
    }

    return res;
  };
};

// Create Supabase client with enhanced configuration and error handling

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new SecureStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: "supabase.auth.token",
    flowType: "pkce",
  },
  global: {
    headers: {
      "X-Client-Info": "plate-app",
      "X-Client-Version": "1.0.0",
    },
    fetch: createCachedFetch(),
  },
  // Add timeout configuration
  db: {
    schema: "public",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Test Supabase connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("⚠️ Supabase connection test warning:", error.message);
    } else {
    }
  } catch (error) {
    console.error("❌ Supabase connection test failed:", error);
  }
};

// Test connection in production (with delay to avoid blocking)
if (!__DEV__) {
  setTimeout(testConnection, 1000);
}

// Enhanced app state handling with error boundaries
let appStateListener: any = null;

const handleAppStateChange = (state: string) => {
  try {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  } catch (error) {
    console.error("❌ App state change error:", error);
  }
};

// Clean up existing listener before adding new one
if (appStateListener) {
  appStateListener.remove();
}

// Add app state listener with error handling
try {
  appStateListener = AppState.addEventListener("change", handleAppStateChange);
} catch (error) {
  console.error("❌ Failed to register app state listener:", error);
}

// Export connection test function for debugging
export { testConnection };
