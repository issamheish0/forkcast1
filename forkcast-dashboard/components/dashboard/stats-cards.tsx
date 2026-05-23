// components/dashboard/stats-cards.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpIcon, ArrowDownIcon, ArrowRightIcon } from "lucide-react"
import Link from "next/link"

interface StatCard {
  title: string
  value: string
  description: string
  trend?: {
    value: number
    isPositive: boolean
  } | null
  link?: string
}

interface StatsCardsProps {
  stats: StatCard[]
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            {stat.trend && (
              <div className={`flex items-center text-xs ${
                stat.trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.trend.isPositive ? (
                  <ArrowUpIcon className="h-4 w-4" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4" />
                )}
                <span>{stat.trend.value}%</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {stat.link ? (
              <Link href={stat.link} className="group">
                <div className="text-xl font-bold group-hover:text-primary transition-colors">
                    {stat.value}
                  <ArrowRightIcon className="inline-block h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ) : (
              <div className="text-xl font-bold">{stat.value}</div>
            )}
            <p className="text-xs text-muted-foreground text-sm">{stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
