// app/api/places/autocomplete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { googlePlacesService } from '@/lib/services/google-places';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // Verify authentication to prevent abuse of Google Places API
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    // Check if Google Places API is available
    if (!googlePlacesService.isAvailable()) {
      console.warn('Google Places API not available, skipping autocomplete');
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const options: any = {};
    
    if (lat && lng) {
      options.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    
    if (radius) {
      options.radius = parseInt(radius);
    }

    const results = await googlePlacesService.getAddressSuggestions(query, options);
    
    return NextResponse.json({ results, success: true }, { status: 200 });
  } catch (error: any) {
    // Log detailed error but don't expose internals
    console.error('Places autocomplete API error:', {
      message: error?.message,
      status: error?.status,
      query
    });
    
    // Return empty results instead of error - client-side will fallback to other services
    // This prevents blocking the user experience
    return NextResponse.json({ 
      results: [],
      success: false,
      fallback: true 
    }, { status: 200 });
  }
}