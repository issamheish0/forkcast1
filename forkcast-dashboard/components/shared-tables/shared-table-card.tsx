// components/shared-tables/shared-table-card.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Users, 
  Eye, 
  Clock,
  MapPin,
  DollarSign,
  Utensils
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SharedTableSummary } from "@/types"

interface SharedTableCardProps {
  table: SharedTableSummary
  onViewBookings: () => void
}

export function SharedTableCard({ table, onViewBookings }: SharedTableCardProps) {
  const occupancyPercentage = (table.current_occupancy / table.capacity) * 100
  
  const getOccupancyColor = (percentage: number) => {
    if (percentage === 0) return "text-muted-foreground"
    if (percentage < 50) return "text-green-600"
    if (percentage < 80) return "text-yellow-600"
    return "text-red-600"
  }

  const getOccupancyBadgeVariant = (percentage: number) => {
    if (percentage === 0) return "secondary"
    if (percentage < 50) return "default"
    if (percentage < 80) return "secondary"
    return "destructive"
  }

  return (
    <Card className="transition-colors hover:bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Table {table.table_number}
          </CardTitle>
          <Badge 
            variant={getOccupancyBadgeVariant(occupancyPercentage)}
            className="ml-2"
          >
            {occupancyPercentage === 100 ? "Full" : "Available"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Occupancy Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Occupancy</span>
          </div>
          <span className={cn("font-semibold", getOccupancyColor(occupancyPercentage))}>
            {table.current_occupancy}/{table.capacity}
          </span>
        </div>

        {/* Visual Occupancy Bar */}
        <div className="space-y-1">
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all",
                occupancyPercentage < 50 ? "bg-green-500" :
                occupancyPercentage < 80 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-sm">{Math.round(occupancyPercentage)}% occupied
          </p>
        </div>

        {/* Table Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Section</span>
          </div>
          <span className="font-medium">
            {table.section_name || "Main Dining"}
          </span>

          <div className="flex items-center space-x-2">
            <Utensils className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Capacity</span>
          </div>
          <span className="font-medium">
            {table.capacity} seats
          </span>
        </div>

        {/* Today's Stats */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Today's Bookings</span>
            </div>
            <span className="font-semibold">{table.total_bookings_today}</span>
          </div>
          
          {table.revenue_today > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Revenue</span>
              </div>
              <span className="font-semibold">
                ${table.revenue_today.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onViewBookings}
            className="w-full"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Bookings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
