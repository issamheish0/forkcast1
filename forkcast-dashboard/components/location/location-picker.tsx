// components/location/location-picker.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Navigation, 
  Search, 
  Loader2, 
  RefreshCw,
  Target,
  Check,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useGeolocation, useLocationRequest } from '@/lib/hooks/useGeolocation';
import { geocodingService, type GeocodingResult } from '@/lib/services/geocoding';
import { formatCoordinates, parseCoordinates, type Coordinates } from '@/lib/utils/location';
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

export interface LocationPickerProps {
  value?: Coordinates | null;
  onChange: (coordinates: Coordinates, address?: string) => void;
  initialAddress?: string;
  className?: string;
  disabled?: boolean;
  height?: number;
  showAddressSearch?: boolean;
  showCurrentLocation?: boolean;
  showCoordinateInput?: boolean;
  zoom?: number;
}

interface LocationPickerState {
  selectedLocation: Coordinates | null;
  address: string;
  searchQuery: string;
  searchResults: GeocodingResult[];
  isSearching: boolean;
  isReverseGeocoding: boolean;
  showAdvanced: boolean;
  mapReady: boolean;
}

// Map click handler — defined at module level so its identity is stable across renders
function MapEvents({
  disabled,
  onMapClick,
}: {
  disabled: boolean;
  onMapClick: (coords: Coordinates) => void;
}) {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useMapEvents } = require('react-leaflet');
  useMapEvents({
    click: (e: any) => {
      if (!disabled) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Fix for default marker icons in Leaflet with Next.js
let DefaultIcon: any;
if (typeof window !== 'undefined') {
  const L = require('leaflet');
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
  DefaultIcon = L.Icon.Default;
}

export function LocationPicker({
  value,
  onChange,
  initialAddress = '',
  className = '',
  disabled = false,
  height = 400,
  showAddressSearch = true,
  showCurrentLocation = true,
  showCoordinateInput = false,
  zoom = 13
}: LocationPickerProps) {
  const [state, setState] = useState<LocationPickerState>({
    selectedLocation: value || null,
    address: initialAddress,
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    isReverseGeocoding: false,
    showAdvanced: false,
    mapReady: false
  });

  const mapKey = useId();
  const { requestLocation, loading: locationLoading } = useLocationRequest();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<any>(null);

  // Handle location changes
  const handleLocationChange = useCallback(async (coordinates: Coordinates, skipReverseGeocode = false) => {
    setState(prev => ({ ...prev, selectedLocation: coordinates }));
    
    if (!skipReverseGeocode) {
      setState(prev => ({ ...prev, isReverseGeocoding: true }));
      
      try {
        const result = await geocodingService.reverseGeocode(coordinates);
        const newAddress = result?.address || '';
        setState(prev => ({ 
          ...prev, 
          address: newAddress,
          isReverseGeocoding: false 
        }));
        onChange(coordinates, newAddress);
      } catch (error) {
        console.warn('Reverse geocoding failed:', error);
        setState(prev => ({ ...prev, isReverseGeocoding: false }));
        onChange(coordinates);
      }
    } else {
      onChange(coordinates, state.address);
    }
  }, [onChange, state.address]);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      const { coordinates } = await requestLocation({
        enableHighAccuracy: true,
        timeout: 10000
      });
      
      await handleLocationChange(coordinates);
      toast.success('Current location detected');
      
      // Center map on current location
      if (mapRef.current) {
        mapRef.current.setView([coordinates.lat, coordinates.lng], zoom);
      }
    } catch (error) {
      console.warn('Failed to get current location:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to get current location: ${errorMessage}`);
    }
  }, [requestLocation, handleLocationChange, zoom]);

  // Search addresses
  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setState(prev => ({ ...prev, searchResults: [] }));
      return;
    }

    setState(prev => ({ ...prev, isSearching: true }));
    
    try {
      const results = await geocodingService.getAddressSuggestions(
        query,
        state.selectedLocation || undefined,
        8
      );
      setState(prev => ({ 
        ...prev, 
        searchResults: results,
        isSearching: false 
      }));
    } catch (error) {
      console.warn('Address search failed:', error);
      setState(prev => ({ 
        ...prev, 
        searchResults: [],
        isSearching: false 
      }));
      toast.error('Address search failed');
    }
  }, [state.selectedLocation]);

  // Handle search input changes
  const handleSearchChange = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
    
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchAddresses(query);
    }, 300);
  }, [searchAddresses]);

  // Handle search result selection
  const handleSearchResultSelect = useCallback(async (result: GeocodingResult) => {
    setState(prev => ({ 
      ...prev, 
      searchQuery: result.displayName,
      searchResults: [],
      address: result.address
    }));
    
    await handleLocationChange(result.coordinates, true);
    
    // Center map on selected location
    if (mapRef.current) {
      mapRef.current.setView([result.coordinates.lat, result.coordinates.lng], zoom);
    }
  }, [handleLocationChange, zoom]);

  // Handle coordinate input
  const handleCoordinateInput = useCallback((input: string) => {
    const coordinates = parseCoordinates(input);
    if (coordinates) {
      handleLocationChange(coordinates);
      
      // Center map on coordinates
      if (mapRef.current) {
        mapRef.current.setView([coordinates.lat, coordinates.lng], zoom);
      }
    }
  }, [handleLocationChange, zoom]);

  // Initialize with value
  useEffect(() => {
    if (value && (!state.selectedLocation || 
        state.selectedLocation.lat !== value.lat || 
        state.selectedLocation.lng !== value.lng)) {
      setState(prev => ({ ...prev, selectedLocation: value }));
    }
  }, [value, state.selectedLocation]);

  // Center map when location changes
  useEffect(() => {
    if (state.selectedLocation && mapRef.current && state.mapReady) {
      mapRef.current.setView([state.selectedLocation.lat, state.selectedLocation.lng], zoom);
    }
  }, [state.selectedLocation, state.mapReady, zoom]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Picker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address Search */}
        {showAddressSearch && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for an address..."
                value={state.searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                disabled={disabled}
                className="pl-10"
              />
              {state.isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 motion-safe:animate-spin" />
              )}
            </div>
            
            {/* Search Results */}
            {state.searchResults.length > 0 && (
              <div className="border border-border rounded-md bg-background max-h-48 overflow-y-auto">
                {state.searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearchResultSelect(result)}
                    disabled={disabled}
                    className="w-full text-left p-3 hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0 disabled:opacity-50"
                  >
                    <div className="font-medium text-sm">{result.displayName}</div>
                    <div className="text-xs text-muted-foreground text-sm">{formatCoordinates(result.coordinates)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Current Location Button */}
        {showCurrentLocation && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={getCurrentLocation}
              disabled={disabled || locationLoading}
              className="flex items-center gap-2"
            >
              {locationLoading ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              Use Current Location
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setState(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
              className="flex items-center gap-2"
            >
              Advanced
              {state.showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* Advanced Options */}
        {state.showAdvanced && (
          <div className="space-y-2 p-3 border border-border rounded-md bg-muted/20">
            {/* Coordinate Input */}
            {showCoordinateInput && (
              <div>
                <label className="text-sm font-medium">Enter Coordinates (lat, lng):</label>
                <Input
                  placeholder="e.g., 33.8938, 35.5018"
                  onChange={(e) => handleCoordinateInput(e.target.value)}
                  disabled={disabled}
                  className="mt-1"
                />
              </div>
            )}
            
            {/* Current Coordinates Display */}
            {state.selectedLocation && (
              <div>
                <label className="text-sm font-medium">Selected Coordinates:</label>
                <div className="text-sm text-muted-foreground font-mono mt-1">
                  {formatCoordinates(state.selectedLocation)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Map */}
        <div className="relative" style={{ height: `${height}px` }}>
          {typeof window !== 'undefined' && (
            <MapContainer
              key={mapKey}
              center={state.selectedLocation ? [state.selectedLocation.lat, state.selectedLocation.lng] : [33.8938, 35.5018]} // Default to Beirut
              zoom={zoom}
              style={{ height: '100%', width: '100%' }}
              ref={mapRef}
              whenReady={() => setState(prev => ({ ...prev, mapReady: true }))}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {state.selectedLocation && (
                <Marker position={[state.selectedLocation.lat, state.selectedLocation.lng]} />
              )}
              
              <MapEvents disabled={disabled} onMapClick={handleLocationChange} />
            </MapContainer>
          )}
          
          {/* Loading overlay */}
          {!state.mapReady && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Loader2 className="h-5 w-5 motion-safe:animate-spin" />
            </div>
          )}
        </div>

        {/* Selected Address Display */}
        {state.address && (
          <div className="p-3 border border-border rounded-md bg-muted/20">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">Selected Address:</div>
                <div className="text-sm text-muted-foreground">{state.address}</div>
                {state.isReverseGeocoding && (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="h-3 w-3 motion-safe:animate-spin" />
                    <span className="text-xs text-muted-foreground">Getting address...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground text-sm">Click on the map to select a location, search for an address, or use your current location.
        </div>
      </CardContent>
    </Card>
  );
}
