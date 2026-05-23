// components/dashboard/top-customers.tsx
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface Customer {
  user_id: string
  user: {
    full_name: string
    avatar_url?: string | null
  }
  count: number
}

interface TopCustomersProps {
  customers: Customer[]
}

export function TopCustomers({ customers }: TopCustomersProps) {
  if (!customers || customers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
          <CardDescription>
            Your most frequent diners
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground text-sm">No customer data available yet
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Customers</CardTitle>
        <CardDescription>
          Your most frequent diners
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {customers.map((customer, index) => (
            <div key={customer.user_id} className="flex items-center gap-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-semibold">
                {index + 1}
              </div>
              <Avatar className="h-10 w-10">
                <AvatarImage src={customer.user.avatar_url || undefined} />
                <AvatarFallback>
                  {customer.user.full_name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{customer.user.full_name}</p>
                <p className="text-sm text-muted-foreground text-sm">{customer.count} {customer.count === 1 ? 'visit' : 'visits'}
                </p>
              </div>
              
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
