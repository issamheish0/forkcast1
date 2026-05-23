// components/dashboard/table-status-view.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  Table2,
  Users,
  Clock,
  ChefHat,
  Calendar,
  AlertCircle,
  Maximize2,
  Grid3X3
} from "lucide-react"
import { format, addMinutes, isWithinInterval } from "date-fns"

interface TableStatusViewProps {
  tables: any[]
  bookings: any[]
  currentTime: Date
  onTableClick?: (table: any) => void
  onAssignTable?: (bookingId: string, tableId: string) => void
}

const TABLE_TYPE_COLORS:any = {
  booth: "bg-primary/20 border-primary text-primary",
  window: "bg-accent/30 border-accent text-accent-foreground",
  patio: "bg-secondary/50 border-secondary text-secondary-foreground",
  standard: "bg-muted border-border text-muted-foreground",
  bar: "bg-accent/40 border-accent text-accent-foreground",
  private: "bg-primary/30 border-primary text-primary",
}

const TABLE_TYPE_ICONS:any = {
  booth: "🛋️",
  window: "🪟",
  patio: "🌿",
  standard: "🪑",
  bar: "🍺",
  private: "🔒",
}

export function TableStatusView({ 
  tables, 
  bookings, 
  currentTime,
  onTableClick,
  onAssignTable 
}: TableStatusViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "floor">("grid")
  const [selectedTableType, setSelectedTableType] = useState<string>("all")

  // Get current and upcoming bookings for each table
  const getTableStatus = (table: any) => {
    const tableBookings = bookings.filter(booking => 
      booking.tables?.some((t: any) => t.id === table.id) &&
      booking.status === 'confirmed'
    )

    // Current booking
    const currentBooking = tableBookings.find(booking => {
      const bookingStart = new Date(booking.booking_time)
      const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
      return isWithinInterval(currentTime, { start: bookingStart, end: bookingEnd })
    })

    // Next booking
    const upcomingBookings = tableBookings
      .filter(booking => new Date(booking.booking_time) > currentTime)
      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
    
    const nextBooking = upcomingBookings[0]

    return {
      isOccupied: !!currentBooking,
      currentBooking,
      nextBooking,
      bookingsToday: tableBookings.length
    }
  }

  // Filter tables by type
  const displayTables = selectedTableType === "all" 
    ? tables.filter(t => t.is_active)
    : tables.filter(t => t.is_active && t.table_type === selectedTableType)

  // Calculate statistics
  const stats = {
    total: displayTables.length,
    occupied: displayTables.filter(t => getTableStatus(t).isOccupied).length,
    available: displayTables.filter(t => !getTableStatus(t).isOccupied).length,
  }

  const occupancyRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Table Status</CardTitle>
            <CardDescription>
              {stats.occupied} of {stats.total} tables occupied • {occupancyRate}% occupancy
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Object.entries(TABLE_TYPE_COLORS).map(([type, _]) => (
                <Button
                  key={type}
                  size="sm"
                  variant={selectedTableType === type ? "default" : "outline"}
                  className="h-8 px-2"
                  onClick={() => setSelectedTableType(type)}
                >
                  {TABLE_TYPE_ICONS[type as keyof typeof TABLE_TYPE_ICONS]}
                </Button>
              ))}
              <Button
                size="sm"
                variant={selectedTableType === "all" ? "default" : "outline"}
                className="h-8"
                onClick={() => setSelectedTableType("all")}
              >
                All
              </Button>
            </div>
            <div className="flex gap-1 ml-2">
              <Button
                size="sm"
                variant={viewMode === "grid" ? "default" : "outline"}
                className="h-8 px-2"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === "floor" ? "default" : "outline"}
                className="h-8 px-2"
                onClick={() => setViewMode("floor")}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayTables.map((table) => {
              const status = getTableStatus(table)
              const colors = TABLE_TYPE_COLORS[table.table_type]
              
              return (
                <div
                  key={table.id}
                  className={cn(
                    "relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                    colors,
                    status.isOccupied ? "ring-2 ring-green-500" : "",
                    onTableClick && "hover:scale-105"
                  )}
                  onClick={() => onTableClick?.(table)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <Table2 className="h-4 w-4" />
                      <span className="font-bold">{table.table_number}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {table.min_capacity}-{table.max_capacity}
                    </Badge>
                  </div>

                  {status.isOccupied && status.currentBooking ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs">
                        <ChefHat className="h-3 w-3" />
                        <span className="truncate font-medium">
                          {status.currentBooking.user?.full_name || status.currentBooking.guest_name || 'Guest'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground text-sm"><Users className="h-3 w-3" />
                        <span>{status.currentBooking.party_size} guests</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground text-sm"><Clock className="h-3 w-3" />
                        <span>
                          Until {format(
                            addMinutes(
                              new Date(status.currentBooking.booking_time), 
                              status.currentBooking.turn_time_minutes || 120
                            ), 
                            'h:mm a'
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="secondary" className="w-full justify-center text-xs">
                        Available
                      </Badge>
                      {status.nextBooking && (
                        <div className="text-xs text-muted-foreground text-sm"><div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Next: {format(new Date(status.nextBooking.booking_time), 'h:mm a')}
                          </div>
                          <div className="truncate">
                            {status.nextBooking.user?.full_name || status.nextBooking.guest_name} ({status.nextBooking.party_size})
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {table.features && table.features.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {table.features.slice(0, 2).map((feature: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Quick indicator for bookings today */}
                  {status.bookingsToday > 0 && (
                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {status.bookingsToday}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div 
            className="relative bg-slate-50 rounded-lg border-2 border-dashed"
            style={{ height: "600px" }}
          >
            {/* Floor plan visualization */}
            {displayTables.map((table) => {
              const status = getTableStatus(table)
              const colors = TABLE_TYPE_COLORS[table.table_type]
              
              return (
                <div
                  key={table.id}
                  className={cn(
                    "absolute p-2 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg",
                    colors,
                    status.isOccupied ? "ring-2 ring-green-500 scale-105" : "",
                    table.shape === "circle" ? "rounded-full" : "rounded-lg"
                  )}
                  style={{
                    left: `${table.x_position}%`,
                    top: `${table.y_position}%`,
                    width: `${(table.width || 60) * 0.8}px`,
                    height: `${(table.height || 40) * 0.8}px`,
                  }}
                  onClick={() => onTableClick?.(table)}
                >
                  <div className="text-center text-xs font-bold">
                    {TABLE_TYPE_ICONS[table.table_type]} {table.table_number}
                  </div>
                  {status.isOccupied && (
                    <div className="text-xs text-center mt-1">
                      <Users className="h-3 w-3 inline" /> {status.currentBooking?.party_size}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg p-3 border">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Occupied</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-300 rounded" />
                  <span>Available</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
