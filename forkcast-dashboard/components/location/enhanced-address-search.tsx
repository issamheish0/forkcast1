// components/location/enhanced-address-search.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Loader2, 
  MapPin, 
  Navigation, 
  X,
  Star,
  Camera,
  Building,
  Clock
} from 'lucide-react';
import { useLocationRequest } from '@/lib/hooks/useGeolocation';
import { enhancedGeocodingService, type EnhancedGeocodingResult } from '@/lib/services/enhanced-geocoding';
import { formatCoordinates, type Coordinates } from '@/lib/utils/location';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export interface EnhancedAddressSearchProps {
  value?: string;
  onChange: (address: string, coordinates?: Coordinates, result?: EnhancedGeocodingResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showCurrentLocation?: boolean;
  maxResults?: number;
  userLocation?: Coordinates;
  searchType?: 'all' | 'restaurants' | 'addresses';
  showBusinessDetails?: boolean;
}

interface SearchState {
  query: string;
  results: EnhancedGeocodingResult[];
  isSearching: boolean;
  showDropdown: boolean;
  selectedIndex: number;
}

export function EnhancedAddressSearch({
  value = '',
  onChange,
  placeholder = 'Search for businesses, restaurants, or addresses in Lebanon...',
  className = '',
  disabled = false,
  showCurrentLocation = true,
  maxResults = 8,
  userLocation,
  searchType = 'all',
  showBusinessDetails = true
}: EnhancedAddressSearchProps) {
  const [state, setState] = useState<SearchState>({
    query: value,
    results: [],
    isSearching: false,
    showDropdown: false,
    selectedIndex: -1
  });

  const { requestLocation, loading: locationLoading } = useLocationRequest();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search for addresses/businesses
  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 2) {
      setState(prev => ({ 
        ...prev, 
        results: [], 
        showDropdown: false,
        selectedIndex: -1 
      }));
      return;
    }

    setState(prev => ({ ...prev, isSearching: true }));
    
    try {
      let results: EnhancedGeocodingResult[];
      
      switch (searchType) {
        case 'restaurants':
          results = await enhancedGeocodingService.searchRestaurants(
            query,
            userLocation,
            maxResults
          );
          break;
        case 'addresses':
          results = await enhancedGeocodingService.getAddressSuggestions(
            query,
            userLocation,
            maxResults
          );
          break;
        default:
          results = await enhancedGeocodingService.searchAddresses(
            query,
            userLocation,
            maxResults
          );
      }
      
      setState(prev => ({ 
        ...prev, 
        results,
        isSearching: false,
        showDropdown: results.length > 0,
        selectedIndex: -1
      }));
    } catch (error) {
      console.warn('Enhanced address search failed:', error);
      setState(prev => ({ 
        ...prev, 
        results: [],
        isSearching: false,
        showDropdown: false,
        selectedIndex: -1
      }));
      toast.error('Search failed. Please try again.');
    }
  }, [userLocation, maxResults, searchType]);

  // Handle input changes
  const handleInputChange = useCallback((inputValue: string) => {
    setState(prev => ({ ...prev, query: inputValue }));
    
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchAddresses(inputValue);
    }, 300);
  }, [searchAddresses]);

  // Handle result selection
  const handleResultSelect = useCallback((result: EnhancedGeocodingResult) => {
    setState(prev => ({ 
      ...prev, 
      query: result.displayName,
      showDropdown: false,
      selectedIndex: -1
    }));
    
    onChange(result.address, result.coordinates, result);
    inputRef.current?.blur();
  }, [onChange]);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      const { coordinates } = await requestLocation({
        enableHighAccuracy: true,
        timeout: 10000
      });
      
      setState(prev => ({ ...prev, isSearching: true }));
      
      const address = await enhancedGeocodingService.reverseGeocode(coordinates);
      const displayAddress = address || `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
      
      setState(prev => ({ 
        ...prev, 
        query: displayAddress,
        isSearching: false,
        showDropdown: false
      }));
      
      onChange(displayAddress, coordinates);
      toast.success('Current location detected');
      
    } catch (error) {
      console.warn('Failed to get current location:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to get current location: ${errorMessage}`);
      setState(prev => ({ ...prev, isSearching: false }));
    }
  }, [requestLocation, onChange]);

  // Clear search
  const clearSearch = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      query: '',
      results: [],
      showDropdown: false,
      selectedIndex: -1
    }));
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!state.showDropdown || state.results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.results.length - 1)
        }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, -1)
        }));
        break;
      case 'Enter':
        e.preventDefault();
        if (state.selectedIndex >= 0 && state.selectedIndex < state.results.length) {
          handleResultSelect(state.results[state.selectedIndex]);
        }
        break;
      case 'Escape':
        setState(prev => ({ 
          ...prev, 
          showDropdown: false,
          selectedIndex: -1 
        }));
        inputRef.current?.blur();
        break;
    }
  }, [state.showDropdown, state.results, state.selectedIndex, handleResultSelect]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setState(prev => ({ 
          ...prev, 
          showDropdown: false,
          selectedIndex: -1 
        }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update query when value prop changes
  useEffect(() => {
    setState(prev => ({ ...prev, query: value || '' }));
  }, [value]);

  const getResultIcon = (result: EnhancedGeocodingResult) => {
    if (result.type === 'restaurant' || result.type === 'cafe') {
      return <Building className="h-4 w-4 text-orange-500" />;
    }
    return <MapPin className="h-4 w-4 text-muted-foreground" />;
  };

  const formatResultType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={state.query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (state.results.length > 0) {
                setState(prev => ({ ...prev, showDropdown: true }));
              }
            }}
            disabled={disabled}
            className="pl-10 pr-10"
          />
          
          {/* Loading indicator */}
          {state.isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 motion-safe:animate-spin" />
          )}
          
          {/* Clear button */}
          {state.query && !state.isSearching && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              disabled={disabled}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* Current location button */}
        {showCurrentLocation && (
          <Button
            variant="outline"
            onClick={getCurrentLocation}
            disabled={disabled || locationLoading}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            {locationLoading ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Current
          </Button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {state.showDropdown && state.results.length > 0 && (
        <div
          ref={dropdownRef}
          className="fixed bg-popover border border-border rounded-md shadow-lg z-[9999] max-h-96 overflow-y-auto"
          style={{
            top: `${inputRef.current?.getBoundingClientRect().bottom ?? 0}px`,
            left: `${inputRef.current?.getBoundingClientRect().left ?? 0}px`,
            width: `${inputRef.current?.getBoundingClientRect().width ?? 0}px`
          }}
        >
          {state.results.map((result, index) => (
            <button
              key={`${result.coordinates.lat}-${result.coordinates.lng}-${index}`}
              onClick={() => handleResultSelect(result)}
              disabled={disabled}
              className={cn(
                'w-full text-left p-4 hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0 disabled:opacity-50 transition-colors',
                index === state.selectedIndex && 'bg-accent text-accent-foreground'
              )}
            >
              <div className="flex items-start gap-3">
                {getResultIcon(result)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-medium text-sm truncate">
                      {result.name || result.displayName}
                    </div>
                    {result.source === 'google' && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                        Google
                      </Badge>
                    )}
                    {result.businessStatus === 'CLOSED_TEMPORARILY' && (
                      <Badge variant="destructive" className="text-xs">
                        Temp. Closed
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-1">
                    {result.address}
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground text-sm"><span>{formatCoordinates(result.coordinates)}</span>
                    {result.type && (
                      <Badge variant="outline" className="text-xs">
                        {formatResultType(result.type)}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Business details */}
                  {showBusinessDetails && (result.rating || result.userRatingCount) && (
                    <div className="flex items-center gap-2 mt-2">
                      {result.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs font-medium">{result.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {result.userRatingCount && (
                        <span className="text-xs text-muted-foreground text-sm">({result.userRatingCount} reviews)
                        </span>
                      )}
                      {result.photoUrl && (
                        <Camera className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {state.showDropdown && state.results.length === 0 && state.query.length >= 2 && !state.isSearching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 p-4">
          <div className="text-sm text-muted-foreground text-center">
            <MapPin className="h-4 w-4 mx-auto mb-2" />
            No results found for "{state.query}"
            <div className="text-xs mt-1">
              Try searching for a specific business name or address in Lebanon
            </div>
          </div>
        </div>
      )}

      {/* Search type info */}
      
    </div>
  );
}
