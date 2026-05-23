// app/api/places/search/route.ts
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
  const type = searchParams.get('type');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const options: any = {};
    
    if (lat && lng) {
      options.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    
    if (radius) {
      options.radius = parseInt(radius);
    }
    
    if (type) {
      options.type = type;
    }

    if (!googlePlacesService.isAvailable()) {
      return NextResponse.json({ results: [] });
    }

    const results = await googlePlacesService.searchPlaces(query, options);
    
    return NextResponse.json({ results });
  } catch (error) {
    console.warn('Places search API error (Google unavailable, returning empty):', error);
    return NextResponse.json({ results: [] });
  }
}