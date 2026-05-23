// lib/services/client-places.ts
import type { Coordinates } from '@/lib/utils/location';
import type { GooglePlaceResult, GooglePlacesSearchOptions } from './google-places';

// Re-export types for convenience
export type { GooglePlaceResult, GooglePlacesSearchOptions };

/**
 * Client-side Google Places service that calls our API routes
 * This avoids CORS issues by making requests through our server
 */
export class ClientPlacesService {
  
  /**
   * Check if Google Places API is available (check if API key is configured)
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/api/places/search?query=test');
      return response.status !== 500; // If server responds without error, API is available
    } catch {
      return false;
    }
  }

  /**
   * Search for places using our API route
   */
  async searchPlaces(
    query: string,
    options: GooglePlacesSearchOptions = {}
  ): Promise<GooglePlaceResult[]> {
    if (query.length < 2) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        query
      });

      if (options.location) {
        params.append('lat', options.location.lat.toString());
        params.append('lng', options.location.lng.toString());
      }

      if (options.radius) {
        params.append('radius', options.radius.toString());
      }

      if (options.type) {
        params.append('type', options.type);
      }

      const response = await fetch(`/api/places/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Client places search error:', error);
      throw new Error('Failed to search places');
    }
  }

  /**
   * Get address suggestions using our API route
   */
  async getAddressSuggestions(
    query: string,
    options: GooglePlacesSearchOptions = {}
  ): Promise<GooglePlaceResult[]> {
    if (query.length < 2) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        query
      });

      if (options.location) {
        params.append('lat', options.location.lat.toString());
        params.append('lng', options.location.lng.toString());
      }

      if (options.radius) {
        params.append('radius', options.radius.toString());
      }

      const response = await fetch(`/api/places/autocomplete?${params}`);
      
      if (!response.ok) {
        console.warn(`Places autocomplete API returned status ${response.status}`);
        return []; // Return empty instead of throwing
      }

      const data = await response.json();
      
      // Check if it's a fallback response
      if (data.fallback === true) {
        console.warn('Places autocomplete using fallback - Google API unavailable');
        return [];
      }
      
      return data.results || [];
    } catch (error) {
      console.error('Client places autocomplete error:', error);
      // Return empty array instead of throwing to allow fallback services to work
      return [];
    }
  }

  /**
   * Search specifically for restaurants
   */
  async searchRestaurants(
    query: string,
    location?: Coordinates
  ): Promise<GooglePlaceResult[]> {
    return this.searchPlaces(query, {
      location,
      type: 'restaurant',
      radius: 25000 // 25km radius
    });
  }
}

// Export singleton instance
export const clientPlacesService = new ClientPlacesService();