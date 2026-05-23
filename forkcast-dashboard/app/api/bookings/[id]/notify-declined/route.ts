import { NextRequest, NextResponse } from "next/server"
import { notifyUserDeclinedByRestaurant } from "@/lib/services/notify-booking-declined"

// POST /api/bookings/[id]/notify-declined - Trigger WhatsApp notification for declined booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const bookingId = resolvedParams.id

    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      )
    }

    console.log('API route: Calling notifyUserDeclinedByRestaurant for booking:', bookingId)
    
    // Call the notification function (this runs server-side, so it will use PLATE_SECRET_KEY)
    await notifyUserDeclinedByRestaurant(bookingId)

    return NextResponse.json({ 
      success: true,
      message: "Notification sent successfully" 
    })
  } catch (error) {
    console.error('Notification API error:', error)
    return NextResponse.json(
      { error: "Failed to send notification", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

