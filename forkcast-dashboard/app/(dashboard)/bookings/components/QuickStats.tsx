"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CalendarIcon,
  Table2,
  AlertTriangle,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  DollarSign,
  Target
} from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickStatsProps {
  stats: {
    upcoming: number
    pending: number
    confirmed: number
    completed: number
    cancelled: number
    no_show: number
    withoutTables: number
    avgPartySize: number
    totalGuests: number
    revenue: number
    needingAttention: number
  }
  tableStats?: {
    utilization: number
    totalTables: number
    peakHour: string
  }
  onStatClick: (statType: string) => void
  className?: string
}

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: any
  trend?: { value: number; isPositive: boolean }
  priority?: "normal" | "high" | "critical"
  onClick?: () => void
  pulse?: boolean
  badge?: { text: string; variant?: "default" | "secondary" | "destructive" | "outline" }
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  priority = "normal",
  onClick,
  pulse = false,
  badge
}: StatCardProps) {
  const getPriorityStyles = () => {
    switch (priority) {
      case "critical":
        return "border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 hover:from-red-100 hover:to-red-200/50 shadow-red-100/50"
      case "high":
        return "border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100/50 hover:from-yellow-100 hover:to-yellow-200/50 shadow-yellow-100/50"
      default:
        return "border-border bg-gradient-to-br from-card to-card/50 hover:from-card hover:to-muted/50"
    }
  }

  const getValueColor = () => {
    switch (priority) {
      case "critical":
        return "text-red-700"
      case "high":
        return "text-yellow-700"
      default:
        return "text-foreground"
    }
  }

  const getIconColor = () => {
    switch (priority) {
      case "critical":
        return "text-red-600"
      case "high":
        return "text-yellow-600"
      default:
        return "text-muted-foreground hover:text-primary"
    }
  }

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm",
        getPriorityStyles(),
        pulse && "motion-safe:animate-pulse",
        onClick && "hover:shadow-lg"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex-1">
          <CardTitle className="text-sm tablet:text-base font-semibold leading-tight mb-1">
            {title}
          </CardTitle>
          {priority === "critical" && (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 bg-red-500 rounded-full motion-safe:animate-pulse" />
              <span className="text-xs font-medium text-red-600">URGENT</span>
            </div>
          )}
        </div>
        <div className="relative">
          <Icon className={cn(
            "h-5 w-5 tablet:h-8 tablet:w-8 transition-colors",
            getIconColor()
          )} />
          {pulse && (
            <div className="absolute inset-0 rounded-full bg-current opacity-20 animate-ping" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className={cn(
            "text-2xl tablet:text-2xl font-bold",
            getValueColor()
          )}>
            {value}
          </div>

          {badge && (
            <Badge variant={badge.variant || "secondary"} className="text-xs">
              {badge.text}
            </Badge>
          )}

          {description && (
            <p className="text-xs tablet:text-sm text-muted-foreground font-medium">
              {description}
            </p>
          )}

          {trend && (
            <div className="flex items-center mt-3 p-2 bg-background/50 rounded-lg">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600 mr-2" />
              )}
              <span className={cn(
                "text-xs tablet:text-sm font-semibold",
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.value}% from last week
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function QuickStats({
  stats,
  tableStats,
  onStatClick,
  className
}: QuickStatsProps) {
  const upcomingNextHour = 5 // This would be calculated from actual data
  const peakTimeUtilization = tableStats?.utilization && tableStats.utilization > 85

  return (
    <div className={cn("grid gap-4 tablet:gap-3 grid-cols-2 tablet:grid-cols-3 xl:grid-cols-6", className)}>
      {/* Today's Operations */}
      <StatCard
        title="Today's Service"
        value={stats.upcoming}
        description={stats.pending > 0 ? `${stats.pending} need response` : "All confirmed"}
        icon={CalendarIcon}
        priority={stats.pending > 0 ? "high" : "normal"}
        onClick={() => onStatClick("today")}
        badge={stats.pending > 0 ? {
          text: `${stats.pending} awaiting`,
          variant: "destructive"
        } : {
          text: "Ready to serve",
          variant: "default"
        }}
      />

      {/* Needs Attention */}
      <StatCard
        title="Needs Attention"
        value={stats.needingAttention}
        description="Requires immediate action"
        icon={AlertTriangle}
        priority={stats.needingAttention > 0 ? "critical" : "normal"}
        onClick={() => onStatClick("attention")}
        pulse={stats.needingAttention > 0}
      />

      {/* Table Utilization */}
      <StatCard
        title="Table Utilization"
        value={`${tableStats?.utilization || 0}%`}
        description={`${tableStats?.totalTables || 0} tables total`}
        icon={Table2}
        trend={{ value: 12, isPositive: true }}
        priority={peakTimeUtilization ? "high" : "normal"}
        onClick={() => onStatClick("tables")}
        badge={peakTimeUtilization ? {
          text: "Peak time",
          variant: "destructive"
        } : undefined}
      />

      {/* Next Hour */}
      <StatCard
        title="Next 60 Minutes"
        value={upcomingNextHour}
        description={upcomingNextHour > 0 ? "Prepare tables & staff" : "No imminent arrivals"}
        icon={Clock}
        priority={upcomingNextHour > 3 ? "high" : "normal"}
        onClick={() => onStatClick("nexthour")}
        badge={upcomingNextHour > 0 ? {
          text: `${upcomingNextHour} arriving soon`,
          variant: upcomingNextHour > 3 ? "destructive" : "default"
        } : undefined}
      />

      {/* Total Guests */}
      <StatCard
        title="Total Guests"
        value={stats.totalGuests}
        description={`Avg party: ${stats.avgPartySize}`}
        icon={Users}
        onClick={() => onStatClick("guests")}
      />

      {/* Performance */}
      <StatCard
        title="Completion Rate"
        value={`${stats.completed + stats.confirmed > 0 ? Math.round((stats.completed / (stats.completed + stats.confirmed + stats.no_show)) * 100) : 100}%`}
        description={`${stats.no_show} no-shows today`}
        icon={CheckCircle2}
        trend={{
          value: stats.no_show > 0 ? -5 : 8,
          isPositive: stats.no_show === 0
        }}
        priority={stats.no_show > 2 ? "high" : "normal"}
        onClick={() => onStatClick("performance")}
      />
    </div>
  )
}
