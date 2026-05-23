// lib/services/geocoding.ts
import type { Coordinates } from '@/lib/utils/location';

export interface GeocodingResult {
  coordinates: Coordinates;
  address: string;
  displayName: string;
  type: string;
  importance: number;
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface ReverseGeocodingResult {
  address: string;
  components: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  displayName: string;
}

/**
 * Geocoding service using OpenStreetMap Nominatim API
 * Free service, no API key required
 */
export class GeocodingService {
  private baseUrl = 'https://nominatim.openstreetmap.org';
  private userAgent = 'PlateRestaurantApp/1.0';
  
  /**
   * Search for coordinates based on address string
   */
  async searchAddress(query: string, options: {
    limit?: number;
    countryCode?: string;
    bounds?: { north: number; south: number; east: number; west: number };
  } = {}): Promise<GeocodingResult[]> {
    const { limit = 5, countryCode, bounds } = options;
    
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: limit.toString(),
        addressdetails: '1',
        extratags: '1',
        namedetails: '1'
      });
      
      if (countryCode) {
        params.append('countrycodes', countryCode);
      }
      
      if (bounds) {
        params.append('viewbox', `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`);
        params.append('bounded', '1');
      }
      
      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.map((item: any): GeocodingResult => ({
        coordinates: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        },
        address: item.display_name,
        displayName: item.display_name,
        type: item.type || 'unknown',
        importance: parseFloat(item.importance || '0'),
        boundingBox: item.boundingbox ? {
          south: parseFloat(item.boundingbox[0]),
          north: parseFloat(item.boundingbox[1]),
          west: parseFloat(item.boundingbox[2]),
          east: parseFloat(item.boundingbox[3])
        } : undefined
      }));
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Failed to search address');
    }
  }
  
  /**
   * Reverse geocoding - get address from coordinates
   */
  async reverseGeocode(coordinates: Coordinates): Promise<ReverseGeocodingResult | null> {
    try {
      const params = new URLSearchParams({
        lat: coordinates.lat.toString(),
        lon: coordinates.lng.toString(),
        format: 'json',
        addressdetails: '1',
        zoom: '18'
      });
      
      const response = await fetch(`${this.baseUrl}/reverse?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Reverse geocoding request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || data.error) {
        return null;
      }
      
      return {
        address: this.formatAddress(data.address),
        components: data.address,
        displayName: data.display_name
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }
  
  /**
   * Search for places by category (restaurants, cafes, etc.)
   */
  async searchPlaces(
    query: string,
    coordinates: Coordinates,
    radiusKm: number = 5,
    category?: string
  ): Promise<GeocodingResult[]> {
    try {
      // Calculate bounding box
      const bounds = this.getBounds(coordinates, radiusKm);
      
      let searchQuery = query;
      if (category) {
        searchQuery = `${category} ${query}`;
      }
      
      return await this.searchAddress(searchQuery, {
        bounds,
        limit: 20
      });
    } catch (error) {
      console.error('Places search error:', error);
      throw new Error('Failed to search places');
    }
  }
  
  /**
   * Get suggestions for autocomplete
   */
  async getAddressSuggestions(
    query: string,
    userLocation?: Coordinates,
    limit: number = 5
  ): Promise<GeocodingResult[]> {
    if (query.length < 3) {
      return [];
    }
    
    const options: any = { limit };
    
    // If user location is provided, search in that area first
    if (userLocation) {
      const bounds = this.getBounds(userLocation, 50); // 50km radius
      options.bounds = bounds;
    }
    
    return await this.searchAddress(query, options);
  }
  
  /**
   * Format address components into a readable string
   */
  private formatAddress(components: any): string {
    const parts = [];
    
    if (components.house_number) {
      parts.push(components.house_number);
    }
    
    if (components.road) {
      parts.push(components.road);
    }
    
    if (components.neighbourhood || components.suburb) {
      parts.push(components.neighbourhood || components.suburb);
    }
    
    if (components.city || components.town || components.village) {
      parts.push(components.city || components.town || components.village);
    }
    
    if (components.state) {
      parts.push(components.state);
    }
    
    if (components.country) {
      parts.push(components.country);
    }
    
    return parts.join(', ');
  }
  
  /**
   * Get bounding box for coordinates and radius
   */
  private getBounds(center: Coordinates, radiusKm: number) {
    const kmPerDegreeLat = 111.32;
    const kmPerDegreeLng = 111.32 * Math.cos((center.lat * Math.PI) / 180);
    
    const latDelta = radiusKm / kmPerDegreeLat;
    const lngDelta = radiusKm / kmPerDegreeLng;
    
    return {
      north: center.lat + latDelta,
      south: center.lat - latDelta,
      east: center.lng + lngDelta,
      west: center.lng - lngDelta
    };
  }
}

// Export singleton instance
export const geocodingService = new GeocodingService();
