// hooks/useNetworkRequest.ts
import { useCallback, useState, useRef } from "react";
import { useNetwork } from "@/context/network-provider";

// Types
export interface RequestConfig {
  // Request options
  timeout?: number;
  retries?: number;
  retryDelay?: number;

  // Offline options
  queueWhenOffline?: boolean;
  offlineQueueType?: string;

  // Cache options
  cacheKey?: string;
  cacheExpiry?: number; // ms

  // UI options
  showNetworkAlerts?: boolean;
}

export interface RequestResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  fromCache: boolean;
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
  key: string;
}

// Simple in-memory cache
const requestCache = new Map<string, CachedData<any>>();

// Simple offline queue (placeholder implementation)
const queueAction = async (type: string, data: any): Promise<void> => {
  // Placeholder for offline queue functionality
};

// Simple sync handler (placeholder implementation)
const registerSyncHandler = (
  handler: (action?: any) => Promise<void>,
): void => {
  // Placeholder for sync handler registration
};

// Default configuration
const DEFAULT_CONFIG: Required<RequestConfig> = {
  timeout: 10000,
  retries: 2,
  retryDelay: 1000,
  queueWhenOffline: true,
  offlineQueueType: "network_request",
  cacheKey: "",
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  showNetworkAlerts: false,
};

// Hook implementation
export function useNetworkRequest<T = any>() {
  const { isOnline, networkState } = useNetwork();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check cache
  const checkCache = useCallback(<T>(key: string, expiry: number): T | null => {
    const cached = requestCache.get(key);

    if (cached) {
      const isExpired = Date.now() - cached.timestamp > expiry;
      if (!isExpired) {
        return cached.data as T;
      } else {
        requestCache.delete(key);
      }
    }

    return null;
  }, []);

  // Save to cache
  const saveToCache = useCallback(<T>(key: string, data: T) => {
    requestCache.set(key, {
      data,
      timestamp: Date.now(),
      key,
    });
  }, []);

  // Execute request with timeout
  const executeRequest = useCallback(
    async <T>(
      url: string,
      options?: RequestInit,
      timeout: number = 10000,
    ): Promise<T> => {
      abortControllerRef.current = new AbortController();

      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: abortControllerRef.current.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Request timeout");
        }

        throw error;
      }
    },
    [],
  );

  // Execute request with retries
  const executeWithRetries = useCallback(
    async <T>(
      url: string,
      options: RequestInit | undefined,
      config: Required<RequestConfig>,
    ): Promise<T> => {
      let lastError: Error = new Error("Unknown error");

      for (let attempt = 0; attempt <= config.retries; attempt++) {
        try {
          // Adjust timeout for slow connections
          const adjustedTimeout =
            networkState.quality === "poor" || networkState.quality === "fair"
              ? config.timeout * 2
              : config.timeout;

          const result = await executeRequest<T>(url, options, adjustedTimeout);
          return result;
        } catch (error) {
          lastError = error as Error;

          if (attempt < config.retries) {
            // Wait before retry with exponential backoff
            const delay = config.retryDelay * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError;
    },
    [executeRequest, networkState.quality],
  );

  // Main request function
  const request = useCallback(
    async <T>(
      url: string,
      options?: RequestInit,
      config?: RequestConfig,
    ): Promise<RequestResult<T>> => {
      const finalConfig = { ...DEFAULT_CONFIG, ...config };
      setError(null);

      // Check cache first
      if (finalConfig.cacheKey) {
        const cached = checkCache<T>(
          finalConfig.cacheKey,
          finalConfig.cacheExpiry,
        );
        if (cached !== null) {
          return {
            data: cached,
            error: null,
            loading: false,
            fromCache: true,
          };
        }
      }

      // Check if offline
      if (!isOnline) {
        if (finalConfig.queueWhenOffline) {
          // Queue for later
          await queueAction(finalConfig.offlineQueueType, {
            url,
            options,
            config: finalConfig,
          });

          const offlineError = new Error("Request queued for offline sync");
          setError(offlineError);

          return {
            data: null,
            error: offlineError,
            loading: false,
            fromCache: false,
          };
        } else {
          const offlineError = new Error("No internet connection");
          setError(offlineError);

          return {
            data: null,
            error: offlineError,
            loading: false,
            fromCache: false,
          };
        }
      }

      // Execute request
      setLoading(true);

      try {
        const data = await executeWithRetries<T>(url, options, finalConfig);

        // Save to cache
        if (finalConfig.cacheKey) {
          saveToCache(finalConfig.cacheKey, data);
        }

        setLoading(false);
        return {
          data,
          error: null,
          loading: false,
          fromCache: false,
        };
      } catch (error) {
        const requestError = error as Error;
        setError(requestError);
        setLoading(false);

        // Queue for retry if it was a network error
        if (
          finalConfig.queueWhenOffline &&
          requestError.message.includes("Network")
        ) {
          await queueAction(finalConfig.offlineQueueType, {
            url,
            options,
            config: finalConfig,
          });
        }

        return {
          data: null,
          error: requestError,
          loading: false,
          fromCache: false,
        };
      }
    },
    [isOnline, checkCache, executeWithRetries, saveToCache, queueAction],
  );

  // Cancel ongoing request
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setLoading(false);
  }, []);

  // Clear cache
  const clearCache = useCallback((key?: string) => {
    if (key) {
      requestCache.delete(key);
    } else {
      requestCache.clear();
    }
  }, []);

  // Register handler for offline sync
  const handleOfflineSync = useCallback(
    async (action: any) => {
      const { url, options, config } = action.payload;
      const result = await executeWithRetries(url, options, config);

      // Save to cache if configured
      if (config.cacheKey) {
        saveToCache(config.cacheKey, result);
      }
    },
    [executeWithRetries, saveToCache],
  );

  // Register sync handler on mount
  registerSyncHandler(handleOfflineSync);

  return {
    request,
    loading,
    error,
    cancel,
    clearCache,
    isOnline,
    networkQuality: networkState.quality,
  };
}
