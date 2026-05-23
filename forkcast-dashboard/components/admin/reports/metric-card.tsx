import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PercentageBadge } from './percentage-badge'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  value: number | string
  /** Raw numeric value for comparison (use when `value` is formatted string) */
  current?: number
  previous?: number
  /** Label shown below the badge, defaults to "vs previous period" */
  compareLabel?: string
  /** Tooltip text explaining the metric */
  info: string
  suffix?: string
  /** Format the numeric value. Defaults to toLocaleString */
  format?: (n: number) => string
  /** Reverse polarity: lower is better */
  reverse?: boolean
  className?: string
  icon?: React.ReactNode
}

function formatDefault(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

export function MetricCard({
  title,
  value,
  current,
  previous,
  compareLabel = 'vs previous period',
  info,
  suffix = '',
  format = formatDefault,
  reverse = false,
  className,
  icon,
}: Props) {
  const displayValue =
    typeof value === 'number' ? format(value) + suffix : value

  const hasPrev = current !== undefined && previous !== undefined

  return (
    <Card className={cn('bg-white', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
            <span className="text-sm font-medium text-muted-foreground truncate">{title}</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {info}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold tracking-tight text-foreground">{displayValue}</span>
          {hasPrev && (
            <PercentageBadge current={current!} previous={previous!} reverse={reverse} />
          )}
        </div>

        {hasPrev && (
          <p className="mt-1 text-xs text-muted-foreground">{compareLabel}</p>
        )}
      </CardContent>
    </Card>
  )
}
