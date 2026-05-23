// components/location/index.ts
export { LocationPicker } from './location-picker';
export { AddressSearch } from './address-search';
export { EnhancedAddressSearch } from './enhanced-address-search';
export { CurrentLocationButton, CurrentLocationIconButton, CurrentLocationTextButton } from './current-location-button';
export { LocationManager } from './location-manager';

// Re-export types and utilities for convenience
export type { Coordinates, LocationInfo } from '@/lib/utils/location';
export { 
  parsePostGISLocation, 
  formatPostGISLocation, 
  calculateDistance, 
  formatDistance, 
  isValidCoordinates,
  getBounds,
  parseCoordinates,
  formatCoordinates
} from '@/lib/utils/location';

export { geocodingService } from '@/lib/services/geocoding';
export type { GeocodingResult, ReverseGeocodingResult } from '@/lib/services/geocoding';

export { useGeolocation, useLocationRequest, checkGeolocationSupport } from '@/lib/hooks/useGeolocation';
export type { GeolocationState, GeolocationError, GeolocationOptions } from '@/lib/hooks/useGeolocation';
