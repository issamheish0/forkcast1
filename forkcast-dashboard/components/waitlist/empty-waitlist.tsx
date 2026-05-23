// components/waitlist/empty-waitlist.tsx

import { Clock, UserPlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EmptyWaitlistProps {
  hasFilters: boolean
  onClearFilters?: () => void
}

export function EmptyWaitlist({ hasFilters, onClearFilters }: EmptyWaitlistProps) {
  if (hasFilters) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No entries found</h3>
          <p className="text-muted-foreground text-center mb-4">
            No waitlist entries match your current filters.
          </p>
          {onClearFilters && (
            <Button variant="outline" onClick={onClearFilters}>
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No waiting list entries</h3>
        <p className="text-muted-foreground text-center mb-4">
          Your restaurant doesn't have any customers on the waiting list yet.
          <br />
          Customers can join the waiting list when their preferred booking time is unavailable.
        </p>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground text-sm"><UserPlus className="h-4 w-4" />
          <span>Waitlist entries will appear here when customers join</span>
        </div>
      </CardContent>
    </Card>
  )
}
