// components/shared-tables/shared-tables-overview.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSharedTablesSummary, useSharedTableStats } from "@/hooks/use-shared-tables"
import { SharedTableCard } from "@/components/shared-tables/shared-table-card"
import { SharedTableBookingsModal } from "@/components/shared-tables/shared-table-bookings-modal"
import { SharedTableAnalytics } from "@/components/shared-tables/shared-table-analytics"
import { CreateSharedTableModal } from "@/components/shared-tables/create-shared-table-modal"
import { 
  Users, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Eye,
  Settings,
  Plus,
  RefreshCw
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { SharedTableSummary } from "@/types"

interface SharedTablesOverviewProps {
  restaurantId: string
}

export function SharedTablesOverview({ restaurantId }: SharedTablesOverviewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTable, setSelectedTable] = useState<SharedTableSummary | null>(null)
  const [showBookingsModal, setShowBookingsModal] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { 
    data: sharedTables, 
    isLoading: tablesLoading, 
    error: tablesError,
    refetch: refetchTables
  } = useSharedTablesSummary(restaurantId, selectedDate)

  const { 
    data: stats, 
    isLoading: statsLoading 
  } = useSharedTableStats(restaurantId, 7)

  const handleViewBookings = (table: SharedTableSummary) => {
    setSelectedTable(table)
    setShowBookingsModal(true)
  }

  const totalOccupancy = sharedTables?.reduce((sum, table) => sum + table.current_occupancy, 0) || 0
  const totalCapacity = sharedTables?.reduce((sum, table) => sum + table.capacity, 0) || 0
  const totalRevenue = sharedTables?.reduce((sum, table) => sum + table.revenue_today, 0) || 0
  const totalBookings = sharedTables?.reduce((sum, table) => sum + table.total_bookings_today, 0) || 0

  if (tablesError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-4">
          <div className="text-center">
            <p className="text-muted-foreground">Failed to load shared tables</p>
            <Button variant="outline" onClick={() => refetchTables()} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Shared Tables</h2>
          <p className="text-muted-foreground text-sm">Manage communal dining and social bookings
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Shared Table
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Occupancy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {totalOccupancy}/{totalCapacity}
            </div>
            <p className="text-xs text-muted-foreground text-sm">{totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0}% occupancy rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{totalBookings}</div>
            <p className="text-xs text-muted-foreground text-sm">Shared table reservations
            </p>
          </CardContent>
        </Card>

     

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Party Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {stats?.average_party_size ? stats.average_party_size.toFixed(1) : "0"}
            </div>
            <p className="text-xs text-muted-foreground text-sm">Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tables Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Tables Status</CardTitle>
          <CardDescription>
            Real-time view of your shared tables and their current occupancy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tablesLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted motion-safe:animate-pulse rounded-lg" />
              ))}
            </div>
          ) : sharedTables && sharedTables.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {sharedTables.map((table) => (
                <SharedTableCard
                  key={table.table_id}
                  table={table}
                  onViewBookings={() => handleViewBookings(table)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Shared Tables</h3>
              <p className="text-muted-foreground mb-4">
                You haven't created any shared tables yet.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Shared Table
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bookings Modal */}
      <SharedTableBookingsModal
        isOpen={showBookingsModal}
        onClose={() => setShowBookingsModal(false)}
        table={selectedTable}
        restaurantId={restaurantId}
        date={selectedDate}
      />

      {/* Analytics Modal */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Shared Tables Analytics</DialogTitle>
          </DialogHeader>
          <SharedTableAnalytics restaurantId={restaurantId} />
        </DialogContent>
      </Dialog>

      {/* Create Shared Table Modal */}
      <CreateSharedTableModal
        restaurantId={restaurantId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  )
}
