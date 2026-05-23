import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  current: number
  previous: number
  suffix?: string
  className?: string
  /** reverse: true means lower is better (e.g. cancellation rate) */
  reverse?: boolean
}

export function pctChange(current: number, previous: number) {
  if (previous === 0 && current === 0) return { value: 0, label: '0%', kind: 'neutral' as const }
  if (previous === 0 && current > 0)  return { value: null, label: 'New', kind: 'new' as const }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  return { value: pct, label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, kind: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' as const }
}

export function PercentageBadge({ current, previous, suffix = '', className, reverse = false }: Props) {
  const change = pctChange(current, previous)

  const isGood =
    change.kind === 'new' ||
    change.kind === 'neutral' ||
    (reverse ? change.kind === 'down' : change.kind === 'up')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
        change.kind === 'new' && 'bg-blue-50 text-blue-700',
        change.kind === 'neutral' && 'bg-gray-100 text-gray-600',
        isGood && change.kind !== 'new' && change.kind !== 'neutral' && 'bg-emerald-50 text-emerald-700',
        !isGood && 'bg-red-50 text-red-600',
        className
      )}
    >
      {change.kind === 'up' && <TrendingUp className="w-3 h-3" />}
      {change.kind === 'down' && <TrendingDown className="w-3 h-3" />}
      {change.kind === 'neutral' && <Minus className="w-3 h-3" />}
      {change.label}{suffix}
    </span>
  )
}
