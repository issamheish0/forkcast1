// components/dashboard/quick-actions.tsx
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Plus,
  UserCheck,
  Table2,
  Clock,
  Calendar,
  Search,
  FileText,
  Phone,
  ChevronRight
} from "lucide-react"
import { useRouter } from "next/navigation"

interface QuickActionsProps {
  onAddBooking: () => void
  stats?: {
    pendingCount: number
    unassignedCount: number
    arrivingSoonCount: number
  }
}

export function QuickActions({ onAddBooking, stats }: QuickActionsProps) {
  const router = useRouter()

  const actions = [
    {
      title: "Add Walk-in",
      description: "Create manual booking",
      icon: Plus,
      onClick: onAddBooking,
      variant: "default" as const,
      badge: null
    },
    {
      title: "Pending Bookings",
      description: "Review and confirm",
      icon: Clock,
      onClick: () => router.push("/bookings?status=pending"),
      variant: "outline" as const,
      badge: stats?.pendingCount || 0
    },
    {
      title: "Assign Tables",
      description: "Tables needed",
      icon: Table2,
      onClick: () => router.push("/bookings?needsTables=true"),
      variant: "outline" as const,
      badge: stats?.unassignedCount || 0
    },
    {
      title: "Check Arrivals",
      description: "Next 30 minutes",
      icon: UserCheck,
      onClick: () => router.push("/bookings?arriving=soon"),
      variant: "outline" as const,
      badge: stats?.arrivingSoonCount || 0
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            className="justify-start h-auto py-3 px-4"
            onClick={action.onClick}
          >
            <action.icon className="h-5 w-5 mr-3" />
              <div className="flex-1 text-left">
              <div className="font-medium">{action.title}</div>
              <div className="text-xs text-muted-foreground">{action.description}</div>
              </div>
              {action.badge !== null && action.badge > 0 && (
              <div className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                  {action.badge}
                </div>
              )}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ))}

        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/bookings")}
          >
            <Calendar className="h-4 w-4 mr-2" />
            All Bookings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/floorsections")}
          >
            <Table2 className="h-4 w-4 mr-2" />
            Floor Plans
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
