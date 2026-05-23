/**
 * Notify user via WhatsApp when booking is declined by restaurant
 */

const FUNCTIONS_BASE_URL = process.env.PLATE_FUNCTIONS_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://auth.plate-app.com';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function notifyUserDeclinedByRestaurant(bookingId: string): Promise<void> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set, skipping WhatsApp notification');
    return;
  }

  // Client-side: use API route wrapper
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/notify-declined`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Failed to send WhatsApp notification:', error);
      }
    } catch (error) {
      console.error('Error calling notification API:', error);
    }
    return;
  }

  // Server-side: call edge function directly
  try {
    const url = `${FUNCTIONS_BASE_URL}/functions/v1/notify-user-declined-by-restaurant`;
    
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not set - cannot authenticate with JWT');
      return;
    }
    
    const headers: HeadersInit = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);
    
    const body = JSON.stringify({ 
      booking_id: bookingId
    });
    
    // Log only in development (no key values exposed)
    if (process.env.NODE_ENV === 'development') {
      console.log('Calling edge function:', {
        url,
        hasAuthHeader: headers.has('Authorization'),
        bookingId
      });
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Failed to send WhatsApp notification:', {
        status: response.status,
        statusText: response.statusText,
        error
      });
      return;
    }

    const result = await response.json();
    if (result.ok) {
      console.log('WhatsApp notification sent successfully');
    } else if (result.ignored) {
      console.log('Notification skipped:', result.reason);
    }
  } catch (error) {
    console.error('Error calling edge function:', error);
  }
}
