// components/location/current-location-button.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Navigation, Loader2, MapPin } from 'lucide-react';
import { useLocationRequest } from '@/lib/hooks/useGeolocation';
import { geocodingService } from '@/lib/services/geocoding';
import { type Coordinates } from '@/lib/utils/location';
import { toast } from 'react-hot-toast';

export interface CurrentLocationButtonProps {
  onLocationDetected: (coordinates: Coordinates, address?: string) => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  includeAddress?: boolean;
  showIcon?: boolean;
  showText?: boolean;
  text?: string;
  className?: string;
}

export function CurrentLocationButton({
  onLocationDetected,
  variant = 'outline',
  size = 'default',
  disabled = false,
  includeAddress = true,
  showIcon = true,
  showText = true,
  text = 'Use Current Location',
  className = ''
}: CurrentLocationButtonProps) {
  const { requestLocation, loading } = useLocationRequest();

  const handleGetCurrentLocation = async () => {
    try {
      const { coordinates, accuracy } = await requestLocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 1 minute
      });

      let address: string | undefined;

      if (includeAddress) {
        try {
          const result = await geocodingService.reverseGeocode(coordinates);
          address = result?.address;
        } catch (error) {
          console.warn('Failed to get address for current location:', error);
          // Still proceed with coordinates only
        }
      }

      onLocationDetected(coordinates, address);
      
      const accuracyText = accuracy ? ` (±${Math.round(accuracy)}m)` : '';
      toast.success(`Current location detected${accuracyText}`);
      
    } catch (error) {
      console.warn('Failed to get current location:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to get current location: ${errorMessage}`);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleGetCurrentLocation}
      disabled={disabled || loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
      ) : showIcon ? (
        <Navigation className="h-4 w-4" />
      ) : null}
      {showText && (
        <span className={showIcon ? 'ml-2' : ''}>
          {loading ? 'Getting location...' : text}
        </span>
      )}
    </Button>
  );
}

// Compact version for tight spaces
export function CurrentLocationIconButton({
  onLocationDetected,
  disabled = false,
  includeAddress = true,
  className = ''
}: Pick<CurrentLocationButtonProps, 'onLocationDetected' | 'disabled' | 'includeAddress' | 'className'>) {
  return (
    <CurrentLocationButton
      onLocationDetected={onLocationDetected}
      variant="outline"
      size="icon"
      disabled={disabled}
      includeAddress={includeAddress}
      showIcon={true}
      showText={false}
      className={className}
    />
  );
}

// Text-only version
export function CurrentLocationTextButton({
  onLocationDetected,
  disabled = false,
  includeAddress = true,
  text = 'Current Location',
  className = ''
}: Pick<CurrentLocationButtonProps, 'onLocationDetected' | 'disabled' | 'includeAddress' | 'text' | 'className'>) {
  return (
    <CurrentLocationButton
      onLocationDetected={onLocationDetected}
      variant="link"
      size="sm"
      disabled={disabled}
      includeAddress={includeAddress}
      showIcon={false}
      showText={true}
      text={text}
      className={className}
    />
  );
}
