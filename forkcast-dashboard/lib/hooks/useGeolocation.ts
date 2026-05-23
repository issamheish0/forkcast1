// lib/hooks/useGeolocation.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Coordinates } from '@/lib/utils/location';

export interface GeolocationState {
  coordinates: Coordinates | null;
  accuracy: number | null;
  error: GeolocationError | null;
  loading: boolean;
  supported: boolean;
}

export interface GeolocationError {
  code: number;
  message: string;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

const DEFAULT_OPTIONS: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 300000, // 5 minutes
  watch: false
};

export function useGeolocation(options: GeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    accuracy: null,
    error: null,
    loading: false,
    supported: typeof navigator !== 'undefined' && 'geolocation' in navigator
  });

  const mergedOptions = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState(prev => ({
      ...prev,
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      },
      accuracy: position.coords.accuracy,
      error: null,
      loading: false
    }));
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let message: string;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Location access denied by user';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        message = 'Location request timed out';
        break;
      default:
        message = 'An unknown error occurred while retrieving location';
    }

    setState(prev => ({
      ...prev,
      error: { code: error.code, message },
      loading: false
    }));
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!state.supported) {
      setState(prev => ({
        ...prev,
        error: { code: -1, message: 'Geolocation is not supported by this browser' }
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        timeout: mergedOptions.timeout,
        maximumAge: mergedOptions.maximumAge
      }
    );
  }, [state.supported, mergedOptions, handleSuccess, handleError]);

  // Auto-fetch location on mount if watch is enabled
  useEffect(() => {
    if (mergedOptions.watch) {
      getCurrentPosition();
    }
  }, [mergedOptions.watch, getCurrentPosition]);

  // Watch position changes if watch is enabled
  useEffect(() => {
    if (!mergedOptions.watch || !state.supported) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        timeout: mergedOptions.timeout,
        maximumAge: mergedOptions.maximumAge
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [mergedOptions.watch, mergedOptions.enableHighAccuracy, mergedOptions.timeout, mergedOptions.maximumAge, state.supported, handleSuccess, handleError]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      coordinates: null,
      accuracy: null,
      error: null,
      loading: false
    }));
  }, []);

  return {
    ...state,
    getCurrentPosition,
    clearError,
    reset
  };
}

/**
 * Hook for one-time location fetching with Promise interface
 */
export function useLocationRequest() {
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback((options: GeolocationOptions = {}): Promise<{
    coordinates: Coordinates;
    accuracy: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      setLoading(true);

      const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLoading(false);
          resolve({
            coordinates: {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            },
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          setLoading(false);
          let message: string;
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out';
              break;
            default:
              message = 'An unknown error occurred while retrieving location';
          }

          reject(new Error(message));
        },
        {
          enableHighAccuracy: mergedOptions.enableHighAccuracy,
          timeout: mergedOptions.timeout,
          maximumAge: mergedOptions.maximumAge
        }
      );
    });
  }, []);

  return {
    requestLocation,
    loading
  };
}

/**
 * Check if geolocation is supported and permission status
 */
export async function checkGeolocationSupport(): Promise<{
  supported: boolean;
  permission?: PermissionState;
}> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { supported: false };
  }

  try {
    // Check permission status if available
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return {
        supported: true,
        permission: permission.state
      };
    }

    return { supported: true };
  } catch (error) {
    return { supported: true }; // Assume supported if permission query fails
  }
}