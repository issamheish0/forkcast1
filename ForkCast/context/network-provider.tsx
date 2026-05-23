// context/network-provider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  PropsWithChildren,
} from "react";
import NetInfo, {
  NetInfoState,
  NetInfoStateType,
} from "@react-native-community/netinfo";

// Types
export type ConnectionQuality =
  | "poor"
  | "fair"
  | "good"
  | "excellent"
  | "unknown";

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetInfoStateType;
  quality: ConnectionQuality;
  isSlowConnection: boolean;
  connectionQuality: ConnectionQuality;
  details: {
    cellularGeneration?: string;
    isConnectionExpensive?: boolean;
  };
}

export interface NetworkContextType {
  // State
  networkState: NetworkState;
  isOnline: boolean;
  isOffline: boolean;
  isLoading: boolean;
  hasInitialized: boolean;

  // Actions
  refresh: () => Promise<void>;
  testConnectionSpeed?: () => Promise<{ downloadSpeed: number; latency: number; quality: string }>;

  // Listeners
  addListener: (callback: (state: NetworkState) => void) => () => void;
}

// Default state - changed to null values to indicate uninitialized
const DEFAULT_NETWORK_STATE: NetworkState = {
  isConnected: false,
  isInternetReachable: false,
  type: NetInfoStateType.unknown,
  quality: "unknown",
  isSlowConnection: false,
  connectionQuality: "unknown",
  details: {},
};

// Context
const NetworkContext = createContext<NetworkContextType | null>(null);

// Provider component
export function NetworkProvider({ children }: PropsWithChildren) {
  const [networkState, setNetworkState] = useState<NetworkState>(
    DEFAULT_NETWORK_STATE,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);
  const listenersRef = useRef<Set<(state: NetworkState) => void>>(new Set());
  const lastUpdateRef = useRef<number>(0);
  const initializationRef = useRef<boolean>(false);

  // Determine connection quality based on network type
  const getConnectionQuality = useCallback(
    (state: NetInfoState): ConnectionQuality => {
      if (!state.isConnected || !state.isInternetReachable) {
        return "poor";
      }

      switch (state.type) {
        case NetInfoStateType.wifi:
        case NetInfoStateType.ethernet:
          return "excellent";

        case NetInfoStateType.cellular:
          const generation = state.details?.cellularGeneration;
          if (generation === "5g") return "excellent";
          if (generation === "4g") return "good";
          if (generation === "3g") return "fair";
          return "poor";

        case NetInfoStateType.bluetooth:
          return "poor";

        default:
          return "unknown";
      }
    },
    [],
  );

  // Process NetInfo state into our format
  const processNetworkState = useCallback(
    (state: NetInfoState): NetworkState => {
      const quality = getConnectionQuality(state);

      // Get cellular generation safely
      const getCellularGeneration = () => {
        if (state.type === NetInfoStateType.cellular && state.details) {
          return (state.details as any)?.cellularGeneration || undefined;
        }
        return undefined;
      };

      return {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        type: state.type,
        quality,
        isSlowConnection: quality === "poor" || quality === "fair",
        connectionQuality: quality,
        details: {
          cellularGeneration: getCellularGeneration(),
          isConnectionExpensive: state.details?.isConnectionExpensive,
        },
      };
    },
    [getConnectionQuality],
  );

  // Update network state and notify listeners
  const updateNetworkState = useCallback(
    (state: NetInfoState) => {
      const newState = processNetworkState(state);

      // Mark as initialized on first real update
      if (!initializationRef.current) {
        initializationRef.current = true;
        setHasInitialized(true);
        setIsLoading(false);
      }

      setNetworkState((prevState) => {
        // Only update if state actually changed (but always update on first initialization)
        if (
          initializationRef.current &&
          prevState.isConnected === newState.isConnected &&
          prevState.isInternetReachable === newState.isInternetReachable &&
          prevState.type === newState.type &&
          prevState.quality === newState.quality
        ) {
          return prevState;
        }

        // Notify listeners (only after initialization)
        if (initializationRef.current) {
          listenersRef.current.forEach((listener) => {
            try {
              listener(newState);
            } catch (error) {
              console.error("[NetworkProvider] Listener error:", error);
            }
          });
        }

        return newState;
      });
    },
    [processNetworkState],
  );

  // Manually refresh network state
  const refresh = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      updateNetworkState(state);
    } catch (error) {
      console.error("[NetworkProvider] Refresh error:", error);
      // Only set loading to false if we haven't initialized yet
      if (!initializationRef.current) {
        setIsLoading(false);
        setHasInitialized(true);
      }
    }
  }, [updateNetworkState]);

  // Add listener for network changes
  const addListener = useCallback((callback: (state: NetworkState) => void) => {
    listenersRef.current.add(callback);

    // Return cleanup function
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  // Initialize network monitoring
  useEffect(() => {
    let mounted = true;

    // Initial fetch with immediate execution
    const initializeNetwork = async () => {
      try {
        const state = await NetInfo.fetch();
        if (mounted) {
          updateNetworkState(state);
        }
      } catch (error) {
        console.error("[NetworkProvider] Initial fetch error:", error);
        if (mounted) {
          setIsLoading(false);
          setHasInitialized(true);
        }
      }
    };

    // Execute immediately
    initializeNetwork();

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (mounted) {
        updateNetworkState(state);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [updateNetworkState]);

  const isOnline = networkState.isConnected && networkState.isInternetReachable;

  // Memoize context value to prevent unnecessary re-renders of all consumers
  const value = useMemo<NetworkContextType>(
    () => ({
      networkState,
      isOnline,
      isOffline: !isOnline,
      isLoading,
      hasInitialized,
      refresh,
      addListener,
      testConnectionSpeed: async () => ({ downloadSpeed: 0, latency: 0, quality: "unknown" }),
    }),
    [networkState, isOnline, isLoading, hasInitialized, refresh, addListener],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

// Hook to use network context
export function useNetwork() {
  const context = useContext(NetworkContext);

  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }

  return context;
}

// Convenience hook for connection status
export function useConnectionStatus() {
  const { networkState, isOnline, isOffline, isLoading, hasInitialized } =
    useNetwork();

  return {
    isOnline,
    isOffline,
    isLoading,
    hasInitialized,
    isConnected: networkState.isConnected,
    isInternetReachable: networkState.isInternetReachable,
    connectionType: networkState.type,
    connectionQuality: networkState.quality,
    isSlowConnection: networkState.isSlowConnection,
  };
}
