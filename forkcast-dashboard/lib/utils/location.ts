// lib/utils/location.ts
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  coordinates: Coordinates;
  address?: string;
  accuracy?: number;
}

/**
 * Convert PostGIS WKB (Well-Known Binary) to lat/lng coordinates
 * PostGIS stores POINT geometry as WKB hexadecimal string
 */
export function parsePostGISLocation(wkbHex: string): Coordinates | null {
  try {
    // Remove '0x' prefix if present
    const hex = wkbHex.replace(/^0x/, '');
    
    // PostGIS POINT WKB format:
    // 01 - byte order (01 = little endian)
    // 01000020 - geometry type (POINT with SRID)
    // E6100000 - SRID (4326 in little endian)
    // Next 16 bytes (32 hex chars): X coordinate (longitude) as IEEE 754 double
    // Next 16 bytes (32 hex chars): Y coordinate (latitude) as IEEE 754 double
    
    if (hex.length < 50) {
      console.error('Invalid WKB hex string length:', hex.length);
      return null;
    }

    // Skip the header: byte order (2) + geometry type (8) + SRID (8) = 18 hex chars
    const coordsHex = hex.substring(18);
    
    if (coordsHex.length < 32) {
      console.error('Invalid coordinates hex string length:', coordsHex.length);
      return null;
    }

    // Extract X (longitude) and Y (latitude) as 8-byte doubles
    const xHex = coordsHex.substring(0, 16);
    const yHex = coordsHex.substring(16, 32);
    
    // Convert hex to IEEE 754 double
    const lng = hexToFloat64(xHex);
    const lat = hexToFloat64(yHex);
    
    // Validate coordinates
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.error('Invalid coordinates:', { lat, lng });
      return null;
    }

    return { lat, lng };
  } catch (error) {
    console.error('Error parsing PostGIS location:', error);
    return null;
  }
}

/**
 * Convert lat/lng coordinates to PostGIS WKB format
 * Creates a POINT geometry with SRID 4326 (WGS84)
 */
export function formatPostGISLocation(coordinates: Coordinates): string {
  const { lat, lng } = coordinates;
  
  // Validate coordinates
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid coordinates provided');
  }

  // PostGIS POINT WKB format for SRID 4326:
  // Byte order: 01 (little endian)
  // Geometry type: 01000020 (POINT with SRID)
  // SRID: E6100000 (4326 in little endian)
  // X coordinate (longitude): 8 bytes IEEE 754 double
  // Y coordinate (latitude): 8 bytes IEEE 754 double
  
  const header = '0101000020E6100000';
  const xHex = float64ToHex(lng);
  const yHex = float64ToHex(lat);
  
  return header + xHex + yHex;
}

/**
 * Convert hexadecimal string to IEEE 754 double precision float
 */
function hexToFloat64(hex: string): number {
  // Create array buffer for 8 bytes
  const buffer = new ArrayBuffer(8);
  const bytes = new Uint8Array(buffer);
  
  // Convert hex pairs to bytes (little endian)
  for (let i = 0; i < 8; i++) {
    const hexPair = hex.substring(i * 2, i * 2 + 2);
    bytes[i] = parseInt(hexPair, 16);
  }
  
  // Read as double precision float
  const view = new DataView(buffer);
  return view.getFloat64(0, true); // true = little endian
}

/**
 * Convert IEEE 754 double precision float to hexadecimal string
 */
function float64ToHex(value: number): string {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, true); // true = little endian
  
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  } else if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km`;
  } else {
    return `${Math.round(distanceKm)}km`;
  }
}

/**
 * Validate coordinates
 */
export function isValidCoordinates(coordinates: Coordinates): boolean {
  const { lat, lng } = coordinates;
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Get bounds for a center point and radius
 * Returns bounding box coordinates for database queries
 */
export function getBounds(center: Coordinates, radiusKm: number): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  // Approximate degrees per kilometer (varies by latitude)
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLng = 111.32 * Math.cos(toRadians(center.lat));
  
  const latDelta = radiusKm / kmPerDegreeLat;
  const lngDelta = radiusKm / kmPerDegreeLng;
  
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta
  };
}

/**
 * Convert address string to a URL-safe format for geocoding
 */
export function formatAddressForGeocoding(address: string): string {
  return encodeURIComponent(address.trim());
}

/**
 * Parse coordinates from various input formats
 */
export function parseCoordinates(input: string): Coordinates | null {
  // Remove any whitespace
  const cleaned = input.trim();
  
  // Try different formats
  const patterns = [
    // "lat,lng" or "lat, lng"
    /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/,
    // "lat lng" (space separated)
    /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      
      if (isValidCoordinates({ lat, lng })) {
        return { lat, lng };
      }
    }
  }
  
  return null;
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(coordinates: Coordinates, precision: number = 6): string {
  return `${coordinates.lat.toFixed(precision)}, ${coordinates.lng.toFixed(precision)}`;
}
