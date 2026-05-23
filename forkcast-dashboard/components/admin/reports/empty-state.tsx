import { BarChart3, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  type?: 'empty' | 'error' | 'loading'
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function EmptyState({
  type = 'empty',
  title,
  description,
  onRetry,
  className,
}: Props) {
  const defaults = {
    empty: {
      icon: <BarChart3 className="w-8 h-8 text-muted-foreground/40" />,
      title: 'No data available',
      description: 'There is no data to display for the selected period.',
    },
    error: {
      icon: <AlertCircle className="w-8 h-8 text-destructive/50" />,
      title: 'Failed to load',
      description: 'Something went wrong loading this data.',
    },
    loading: {
      icon: <RefreshCw className="w-8 h-8 text-muted-foreground/40 animate-spin" />,
      title: 'Loading…',
      description: 'Fetching analytics data.',
    },
  }

  const d = defaults[type]

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center gap-3', className)}>
      {d.icon}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title ?? d.title}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{description ?? d.description}</p>
      </div>
      {type === 'error' && onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-1 gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </Button>
      )}
    </div>
  )
}
