// components/location/location-manager.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Save, 
  Loader2, 
  Navigation,
  RefreshCw,
  Check,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { LocationPicker } from './location-picker';
import { AddressSearch } from './address-search';
import { CurrentLocationButton } from './current-location-button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parsePostGISLocation, formatCoordinates, type Coordinates } from '@/lib/utils/location';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export interface LocationManagerProps {
  restaurantId: string;
  currentAddress?: string;
  className?: string;
}

interface LocationData {
  id: string;
  address: string;
  location: string;
  coordinates: Coordinates | null;
}

export function LocationManager({
  restaurantId,
  currentAddress = '',
  className = ''
}: LocationManagerProps) {
  const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>(currentAddress);
  const [displayAddress, setDisplayAddress] = useState<string>(currentAddress); // For showing in input
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const queryClient = useQueryClient();

  // Fetch current restaurant location
  const { data: locationData, isLoading, error } = useQuery({
    queryKey: ['restaurant-location', restaurantId],
    queryFn: async (): Promise<LocationData> => {
      const response = await fetch(`/api/restaurants/${restaurantId}/location`);
      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }
      const result = await response.json();
      return result.data;
    },
    enabled: !!restaurantId
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async ({ coordinates, address }: { coordinates: Coordinates; address: string }) => {
      const response = await fetch(`/api/restaurants/${restaurantId}/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coordinates, address }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update location');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-location', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['restaurant', restaurantId] });
      setHasChanges(false);
      toast.success('Location updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update location: ${error.message}`);
    }
  });

  // Initialize state when location data loads
  useEffect(() => {
    if (locationData) {
      setSelectedCoordinates(locationData.coordinates);
      if (locationData.address) {
        setSelectedAddress(locationData.address);
        setDisplayAddress(locationData.address); // Initially same as full address
      }
    }
  }, [locationData]);

  // Update address state when currentAddress prop changes
  useEffect(() => {
    if (currentAddress && currentAddress !== selectedAddress) {
      setSelectedAddress(currentAddress);
      setDisplayAddress(currentAddress);
    }
  }, [currentAddress, selectedAddress]);

  // Handle location changes from picker
  const handleLocationChange = (coordinates: Coordinates, address?: string) => {
    setSelectedCoordinates(coordinates);
    if (address) {
      setSelectedAddress(address);
      setDisplayAddress(address); // Picker provides full address
    }
    setHasChanges(true);
  };

  // Handle address changes from search
  const handleAddressChange = (address: string, coordinates?: Coordinates, result?: any) => {
    // Store full address for saving to database
    setSelectedAddress(address);
    // Store display text (business name or displayName) for showing in UI
    const displayText = result?.name || result?.displayName || address;
    setDisplayAddress(displayText);
    if (coordinates) {
      setSelectedCoordinates(coordinates);
    }
    setHasChanges(true);
  };

  // Handle current location detection
  const handleCurrentLocationDetected = (coordinates: Coordinates, address?: string) => {
    setSelectedCoordinates(coordinates);
    if (address) {
      setSelectedAddress(address);
      setDisplayAddress(address);
    }
    setHasChanges(true);
    setShowLocationPicker(true); // Show picker to confirm location
  };

  // Save location changes
  const handleSave = () => {
    if (!selectedCoordinates) {
      toast.error('Please select a location first');
      return;
    }

    updateLocationMutation.mutate({
      coordinates: selectedCoordinates,
      address: selectedAddress
    });
  };

  // Reset changes
  const handleReset = () => {
    if (locationData) {
      setSelectedCoordinates(locationData.coordinates);
      setSelectedAddress(locationData.address || currentAddress);
      setDisplayAddress(locationData.address || currentAddress);
    } else {
      setSelectedCoordinates(null);
      setSelectedAddress(currentAddress);
      setDisplayAddress(currentAddress);
    }
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 motion-safe:animate-spin" />
        <span className="ml-2">Loading location data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive/20 rounded-md bg-destructive/5">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load location data</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Current Location Status */}
      <div className="p-4 border border-border rounded-md bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-medium text-sm mb-2">Current Location</h3>
            {selectedCoordinates ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Location Set</span>
                  <Badge variant="outline" className="text-xs">
                    {formatCoordinates(selectedCoordinates, 4)}
                  </Badge>
                </div>
                {displayAddress && (
                  <p className="text-sm text-muted-foreground">{displayAddress}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-600">No location set</span>
              </div>
            )}
          </div>
          
          {hasChanges && (
            <Badge variant="secondary" className="text-xs">
              Unsaved changes
            </Badge>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <AddressSearch
          onChange={handleAddressChange}
          placeholder="Search for your restaurant address..."
          className="flex-1 min-w-64"
          userLocation={selectedCoordinates || undefined}
        />
        
        <CurrentLocationButton
          onLocationDetected={handleCurrentLocationDetected}
          includeAddress={true}
          text="Use Current"
          variant="outline"
        />
        
        <Button
          variant="outline"
          onClick={() => setShowLocationPicker(!showLocationPicker)}
          className="flex items-center gap-2"
        >
          <Edit3 className="h-4 w-4" />
          {showLocationPicker ? 'Hide Map' : 'Open Map'}
        </Button>
      </div>

      {/* Location Picker */}
      {showLocationPicker && (
        <LocationPicker
          value={selectedCoordinates}
          onChange={handleLocationChange}
          initialAddress={selectedAddress}
          height={400}
          showAddressSearch={false} // We have it above
          showCurrentLocation={false} // We have it above
          showCoordinateInput={true}
          zoom={15}
        />
      )}

      <Separator />

      {/* Save/Reset Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground text-sm">{hasChanges ? (
            <span className="text-amber-600">You have unsaved location changes</span>
          ) : (
            <span>Location is up to date</span>
          )}
        </div>
        
        <div className="flex gap-2">
          {hasChanges && (
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={updateLocationMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          
          <Button
            onClick={handleSave}
            disabled={!hasChanges || !selectedCoordinates || updateLocationMutation.isPending}
            className="flex items-center gap-2"
          >
            {updateLocationMutation.isPending ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {updateLocationMutation.isPending ? 'Saving...' : 'Save Location'}
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
        <p className="mb-1">
          <strong>Tips:</strong>
        </p>
        <ul className="space-y-1 ml-4 list-disc">
          <li>Search for your restaurant address for best accuracy</li>
          <li>Use the map to fine-tune your exact location</li>
          <li>Accurate location helps customers find you and improves delivery</li>
          <li>Location changes are saved to your restaurant profile</li>
        </ul>
      </div>
    </div>
  );
}
