// app/api/restaurants/[id]/location/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parsePostGISLocation, formatPostGISLocation, isValidCoordinates, type Coordinates } from '@/lib/utils/location';
import { geocodingService } from '@/lib/services/geocoding';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user owns this restaurant
    const { data: restaurantData, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, owner_id')
      .eq('id', params.id)
      .single();

    if (restaurantError || !restaurantData) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Allow owner or staff with manager/owner role
    let canUpdate = restaurantData.owner_id === user.id;

    if (!canUpdate) {
      const { data: staffData } = await supabase
        .from('restaurant_staff')
        .select('role')
        .eq('user_id', user.id)
        .eq('restaurant_id', params.id)
        .in('role', ['owner', 'manager'])
        .maybeSingle();
      canUpdate = !!staffData;
    }

    if (!canUpdate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { coordinates, address } = body;

    // Validate coordinates
    if (!coordinates || !isValidCoordinates(coordinates)) {
      return NextResponse.json({ 
        error: 'Invalid coordinates provided' 
      }, { status: 400 });
    }

    // Convert coordinates to PostGIS format
    const postgisLocation = formatPostGISLocation(coordinates);

    // Prepare update data
    const updateData: any = {
      location: postgisLocation,
      updated_at: new Date().toISOString()
    };

    // If address is provided, update it as well
    if (address && typeof address === 'string' && address.trim()) {
      updateData.address = address.trim();
    }

    // Update restaurant location
    const { data, error } = await supabase
      .from('restaurants')
      .update(updateData)
      .eq('id', params.id)
      .select('id, address, location')
      .single();

    if (error) {
      console.error('Error updating restaurant location:', error);
      return NextResponse.json({ 
        error: 'Failed to update location' 
      }, { status: 500 });
    }

    // Parse the updated location for response
    const parsedCoordinates = data.location ? parsePostGISLocation(data.location) : null;

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        address: data.address,
        location: data.location,
        coordinates: parsedCoordinates
      }
    });

  } catch (error) {
    console.error('Error in location update API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, data: requestData } = body;

    if (action === 'geocode') {
      // Geocode an address
      const { address } = requestData;
      
      if (!address || typeof address !== 'string') {
        return NextResponse.json({ 
          error: 'Address is required' 
        }, { status: 400 });
      }

      try {
        const results = await geocodingService.searchAddress(address, { limit: 5 });
        return NextResponse.json({ success: true, data: results });
      } catch (error) {
        console.error('Geocoding error:', error);
        return NextResponse.json({ 
          error: 'Failed to geocode address' 
        }, { status: 500 });
      }
    }

    if (action === 'reverse-geocode') {
      // Reverse geocode coordinates
      const { coordinates } = requestData;
      
      if (!coordinates || !isValidCoordinates(coordinates)) {
        return NextResponse.json({ 
          error: 'Valid coordinates are required' 
        }, { status: 400 });
      }

      try {
        const result = await geocodingService.reverseGeocode(coordinates);
        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        console.error('Reverse geocoding error:', error);
        return NextResponse.json({ 
          error: 'Failed to reverse geocode coordinates' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      error: 'Invalid action' 
    }, { status: 400 });

  } catch (error) {
    console.error('Error in location API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const supabase = await createClient();
    
    // Get restaurant location data
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, address, location')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching restaurant location:', error);
      return NextResponse.json({ 
        error: 'Restaurant not found' 
      }, { status: 404 });
    }

    // Parse PostGIS location if available
    const coordinates = data.location ? parsePostGISLocation(data.location) : null;

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        address: data.address,
        location: data.location,
        coordinates
      }
    });

  } catch (error) {
    console.error('Error in location GET API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
