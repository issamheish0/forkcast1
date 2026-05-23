// lib/services/google-places.ts
import type { Coordinates } from '@/lib/utils/location';

export interface GooglePlaceResult {
  coordinates: Coordinates;
  address: string;
  displayName: string;
  name: string;
  type: string;
  types: string[];
  placeId: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  photoUrl?: string;
}

export interface GooglePlacesSearchOptions {
  location?: Coordinates;
  radius?: number; // in meters
  type?: string;
  language?: string;
  region?: string;
}

/**
 * Google Places API service for enhanced address and business search
 * Specifically optimized for Lebanon with business/restaurant search capabilities
 */
export class GooglePlacesService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';



  
  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!this.apiKey) {
      console.warn('Google Maps API key not configured. Using fallback geocoding service.');
    }
  }

  /**
   * Check if Google Places API is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for places/addresses using Google Places API Text Search
   * This provides much better results for businesses and specific locations
   */
  async searchPlaces(
    query: string,
    options: GooglePlacesSearchOptions = {}
  ): Promise<GooglePlaceResult[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    if (query.length < 2) {
      return [];
    }

    try {
      // Use Places API Text Search for comprehensive results
      const params = new URLSearchParams({
        query: `${query} Lebanon`, // Bias towards Lebanon
        key: this.apiKey,
        language: options.language || 'en',
        region: options.region || 'LB' // Lebanon country code (uppercase)
      });

      // Add strong location bias for Lebanon if no specific location provided
      if (options.location) {
        params.append('location', `${options.location.lat},${options.location.lng}`);
        params.append('radius', (options.radius || 25000).toString()); // 25km default for better precision
      } else {
        // Default to Beirut coordinates for Lebanon bias
        params.append('location', '33.8938,35.5018'); // Beirut coordinates
        params.append('radius', '50000'); // 50km radius to cover most of Lebanon
      }

      // Add type filter if specified
      if (options.type) {
        params.append('type', options.type);
      }

      const response = await fetch(
        `${this.baseUrl}/place/textsearch/json?${params}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'ZERO_RESULTS') {
        return [];
      }

      if (data.status !== 'OK') {
        throw new Error(`Google Places API error: ${data.status}`);
      }

      return data.results.map((place: any): GooglePlaceResult => ({
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        address: place.formatted_address || '',
        displayName: place.name || place.formatted_address || '',
        name: place.name || '',
        type: this.getPrimaryType(place.types || []),
        types: place.types || [],
        placeId: place.place_id,
        businessStatus: place.business_status,
        rating: place.rating,
        userRatingCount: place.user_ratings_total,
        photoUrl: this.getPhotoUrl(place.photos?.[0]?.photo_reference)
      }));

    } catch (error) {
      console.error('Google Places search error:', error);
      throw new Error('Failed to search places');
    }
  }

  /**
   * Search for address suggestions using Google Places Autocomplete
   * Better for address completion and suggestions
   */
  async getAddressSuggestions(
    query: string,
    options: GooglePlacesSearchOptions = {}
  ): Promise<GooglePlaceResult[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    if (query.length < 2) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        input: query,
        key: this.apiKey,
        language: options.language || 'en',
        components: 'country:LB', // Restrict to Lebanon (uppercase)
      });

      // Add strong location bias for Lebanon
      if (options.location) {
        params.append('location', `${options.location.lat},${options.location.lng}`);
        params.append('radius', (options.radius || 25000).toString()); // Smaller radius for better precision
      } else {
        // Default to Beirut coordinates for Lebanon bias
        params.append('location', '33.8938,35.5018'); // Beirut coordinates
        params.append('radius', '25000'); // 25km radius for better local results
      }

      // Add establishment and address types to get both businesses and addresses
      params.append('types', 'establishment|geocode|food|restaurant');

      const response = await fetch(
        `${this.baseUrl}/place/autocomplete/json?${params}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`Google Places Autocomplete API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'ZERO_RESULTS') {
        return [];
      }

      if (data.status !== 'OK') {
        throw new Error(`Google Places Autocomplete API error: ${data.status}`);
      }

      // Get place details for each suggestion
      const detailPromises = data.predictions.slice(0, 8).map(async (prediction: any) => {
        return this.getPlaceDetails(prediction.place_id);
      });

      const details = await Promise.all(detailPromises);
      return details.filter(Boolean) as GooglePlaceResult[];

    } catch (error) {
      console.error('Google Places autocomplete error:', error);
      throw new Error('Failed to get address suggestions');
    }
  }

  /**
   * Get detailed information about a specific place
   */
  async getPlaceDetails(placeId: string): Promise<GooglePlaceResult | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const params = new URLSearchParams({
        place_id: placeId,
        key: this.apiKey,
        fields: 'place_id,name,formatted_address,geometry,types,business_status,rating,user_ratings_total,photos'
      });

      const response = await fetch(
        `${this.baseUrl}/place/details/json?${params}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`Google Place Details API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        return null;
      }

      const place = data.result;
      return {
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        address: place.formatted_address || '',
        displayName: place.name || place.formatted_address || '',
        name: place.name || '',
        type: this.getPrimaryType(place.types || []),
        types: place.types || [],
        placeId: place.place_id,
        businessStatus: place.business_status,
        rating: place.rating,
        userRatingCount: place.user_ratings_total,
        photoUrl: this.getPhotoUrl(place.photos?.[0]?.photo_reference)
      };

    } catch (error) {
      console.error('Google Place Details error:', error);
      return null;
    }
  }

  /**
   * Search specifically for restaurants and food establishments
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

  /**
   * Get primary type for display
   */
  private getPrimaryType(types: string[]): string {
    // Priority order for restaurant-related types
    const typePriority = [
      'restaurant',
      'cafe',
      'bakery',
      'meal_takeaway',
      'food',
      'bar',
      'establishment',
      'point_of_interest'
    ];

    for (const priority of typePriority) {
      if (types.includes(priority)) {
        return priority;
      }
    }

    return types[0] || 'establishment';
  }

  /**
   * Get photo URL if available
   */
  private getPhotoUrl(photoReference?: string): string | undefined {
    if (!photoReference || !this.apiKey) {
      return undefined;
    }

    return `${this.baseUrl}/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${this.apiKey}`;
  }
}

// Export singleton instance
export const googlePlacesService = new GooglePlacesService();