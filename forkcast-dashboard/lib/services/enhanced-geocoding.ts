// lib/services/enhanced-geocoding.ts
import type { Coordinates } from '@/lib/utils/location';
import { clientPlacesService, type GooglePlaceResult } from './client-places';
import { geocodingService, type GeocodingResult } from './geocoding';

export interface EnhancedGeocodingResult {
  coordinates: Coordinates;
  address: string;
  displayName: string;
  name?: string;
  type: string;
  importance: number;
  placeId?: string;
  rating?: number;
  userRatingCount?: number;
  photoUrl?: string;
  source: 'google' | 'osm';
  businessStatus?: string;
  boundingBox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * Enhanced geocoding service that combines Google Places API with OpenStreetMap fallback
 * Provides comprehensive search for Lebanese businesses, places, and addresses
 */
export class EnhancedGeocodingService {
  
  /**
   * Search for addresses and places with enhanced results
   * Prioritizes Google Places API for better business search, falls back to OSM
   */
  async searchAddresses(
    query: string,
    userLocation?: Coordinates,
    limit: number = 8
  ): Promise<EnhancedGeocodingResult[]> {
    const results: EnhancedGeocodingResult[] = [];
    
    try {
      // Try Google Places API first if available
      if (await clientPlacesService.isAvailable()) {
        const googleResults = await this.searchWithGoogle(query, userLocation, limit);
        results.push(...googleResults);
      }
      
      // If we don't have enough results or Google is unavailable, use OSM
      if (results.length < limit) {
        const osmResults = await this.searchWithOSM(query, userLocation, limit - results.length);
        // Filter out duplicates (same location within 100m)
        const filteredOsmResults = osmResults.filter(osmResult => 
          !results.some(existing => 
            this.getDistance(existing.coordinates, osmResult.coordinates) < 0.1 // 100m
          )
        );
        results.push(...filteredOsmResults);
      }
      
      // Sort by relevance (Google results first, then by importance/rating)
      return results
        .sort((a, b) => {
          // Google results first
          if (a.source === 'google' && b.source !== 'google') return -1;
          if (b.source === 'google' && a.source !== 'google') return 1;
          
          // Then by rating for Google results
          if (a.source === 'google' && b.source === 'google') {
            return (b.rating || 0) - (a.rating || 0);
          }
          
          // Then by importance for OSM results
          return b.importance - a.importance;
        })
        .slice(0, limit);
        
    } catch (error) {
      console.error('Enhanced geocoding search error:', error);
      // Fallback to OSM only if Google fails
      return this.searchWithOSM(query, userLocation, limit);
    }
  }

  /**
   * Search specifically for restaurants and food establishments
   */
  async searchRestaurants(
    query: string,
    userLocation?: Coordinates,
    limit: number = 8
  ): Promise<EnhancedGeocodingResult[]> {
    if (await clientPlacesService.isAvailable()) {
      try {
        const googleResults = await clientPlacesService.searchRestaurants(query, userLocation);
        return googleResults.map(this.convertGoogleResult);
      } catch (error) {
        console.error('Google restaurant search failed, falling back to general search:', error);
      }
    }
    
    // Fallback: search with restaurant-specific terms
    return this.searchAddresses(`restaurant ${query}`, userLocation, limit);
  }

  /**
   * Get address suggestions for autocomplete
   */
  async getAddressSuggestions(
    query: string,
    userLocation?: Coordinates,
    limit: number = 5
  ): Promise<EnhancedGeocodingResult[]> {
    if (query.length < 2) {
      return [];
    }

    try {
      // Use Google Places Autocomplete for better suggestions
      if (await clientPlacesService.isAvailable()) {
        // Use user location or default to Beirut for Lebanon bias
        const searchLocation = userLocation || { lat: 33.8938, lng: 35.5018 }; // Beirut coordinates
        
        const googleSuggestions = await clientPlacesService.getAddressSuggestions(query, {
          location: searchLocation,
          radius: userLocation ? 25000 : 50000, // Smaller radius if user location, larger for Beirut default
          language: 'en',
          region: 'LB'
        });
        return googleSuggestions.map(this.convertGoogleResult);
      }
    } catch (error) {
      console.error('Google autocomplete failed, falling back to OSM:', error);
    }

    // Fallback to OSM with Lebanon country code restriction
    const osmResults = await geocodingService.getAddressSuggestions(
      query, 
      userLocation || { lat: 33.8938, lng: 35.5018 }, // Default to Beirut
      limit
    );
    return osmResults.map(this.convertOSMResult);
  }

  /**
   * Reverse geocoding - get address from coordinates
   */
  async reverseGeocode(coordinates: Coordinates): Promise<string | null> {
    // Use existing OSM reverse geocoding (Google reverse geocoding is more complex and expensive)
    const result = await geocodingService.reverseGeocode(coordinates);
    return result?.address || null;
  }

  /**
   * Search using Google Places API
   */
  private async searchWithGoogle(
    query: string, 
    userLocation?: Coordinates, 
    limit: number = 8
  ): Promise<EnhancedGeocodingResult[]> {
    // Use user location or default to Beirut for Lebanon bias
    const searchLocation = userLocation || { lat: 33.8938, lng: 35.5018 }; // Beirut coordinates
    
    // Try both text search and autocomplete for comprehensive results
    const [textResults, autoResults] = await Promise.allSettled([
      clientPlacesService.searchPlaces(query, {
        location: searchLocation,
        radius: userLocation ? 25000 : 50000, // Smaller if user location, larger for Beirut
        language: 'en',
        region: 'LB'
      }),
      clientPlacesService.getAddressSuggestions(query, {
        location: searchLocation,
        radius: userLocation ? 25000 : 50000, // Smaller if user location, larger for Beirut
        language: 'en',
        region: 'LB'
      })
    ]);

    const results: GooglePlaceResult[] = [];
    
    // Add text search results
    if (textResults.status === 'fulfilled') {
      results.push(...textResults.value);
    }
    
    // Add autocomplete results (filter duplicates)
    if (autoResults.status === 'fulfilled') {
      const filtered = autoResults.value.filter(autoResult => 
        !results.some(existing => existing.placeId === autoResult.placeId)
      );
      results.push(...filtered);
    }

    return results
      .slice(0, limit)
      .map(this.convertGoogleResult);
  }

  /**
   * Search using OpenStreetMap
   */
  private async searchWithOSM(
    query: string, 
    userLocation?: Coordinates, 
    limit: number = 8
  ): Promise<EnhancedGeocodingResult[]> {
    // Use user location or default to Beirut for Lebanon bias
    const searchLocation = userLocation || { lat: 33.8938, lng: 35.5018 }; // Beirut coordinates
    
    // Use the searchAddress method directly with Lebanon country code
    const results = await geocodingService.searchAddress(query, {
      limit,
      countryCode: 'lb', // Lebanon country code
    });
    
    return results.map(this.convertOSMResult);
  }

  /**
   * Convert Google Places result to enhanced result
   */
  private convertGoogleResult = (result: GooglePlaceResult): EnhancedGeocodingResult => ({
    coordinates: result.coordinates,
    address: result.address,
    displayName: result.displayName,
    name: result.name,
    type: result.type,
    importance: this.calculateGoogleImportance(result),
    placeId: result.placeId,
    rating: result.rating,
    userRatingCount: result.userRatingCount,
    photoUrl: result.photoUrl,
    source: 'google',
    businessStatus: result.businessStatus
  });

  /**
   * Convert OSM result to enhanced result
   */
  private convertOSMResult = (result: GeocodingResult): EnhancedGeocodingResult => ({
    coordinates: result.coordinates,
    address: result.address,
    displayName: result.displayName,
    type: result.type,
    importance: result.importance,
    source: 'osm',
    boundingBox: result.boundingBox
  });

  /**
   * Calculate importance score for Google Places results
   * Higher rating and more reviews = higher importance
   */
  private calculateGoogleImportance(result: GooglePlaceResult): number {
    let importance = 0.5; // Base importance
    
    if (result.rating) {
      importance += (result.rating / 5) * 0.3; // Rating contributes up to 0.3
    }
    
    if (result.userRatingCount) {
      // More reviews = higher importance (logarithmic scale)
      importance += Math.min(Math.log10(result.userRatingCount) / 4, 0.2); // Up to 0.2
    }
    
    // Business type bonuses
    if (result.types.includes('restaurant') || result.types.includes('cafe')) {
      importance += 0.1;
    }
    
    return Math.min(importance, 1.0);
  }

  /**
   * Calculate distance between two coordinates in kilometers
   */
  private getDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

// Export singleton instance
export const enhancedGeocodingService = new EnhancedGeocodingService();