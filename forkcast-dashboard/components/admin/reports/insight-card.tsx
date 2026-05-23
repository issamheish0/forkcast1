import { AlertTriangle, AlertCircle, Info, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Insight = {
  id: string
  title: string
  explanation: string
  metric: string
  severity: 'low' | 'medium' | 'high'
  suggested_action: string
}

type Props = {
  insight: Insight
}

const severityConfig = {
  high: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-700',
    icon: <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
    label: 'High priority',
    metricBg: 'bg-red-100/60',
  },
  medium: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
    icon: <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />,
    label: 'Medium priority',
    metricBg: 'bg-orange-100/60',
  },
  low: {
    border: 'border-slate-200',
    bg: 'bg-slate-50',
    badge: 'bg-slate-100 text-slate-600',
    icon: <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />,
    label: 'Low priority',
    metricBg: 'bg-slate-100/60',
  },
}

export function InsightCard({ insight }: Props) {
  const s = severityConfig[insight.severity]

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', s.border, s.bg)}>
      <div className="flex items-start gap-2">
        {s.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">{insight.title}</h4>
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', s.badge)}>
              {s.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.explanation}</p>
        </div>
      </div>

      <div className={cn('flex items-center gap-1.5 text-xs font-mono font-medium text-foreground rounded px-2 py-1 w-fit', s.metricBg)}>
        {insight.metric}
      </div>

      <div className="flex items-start gap-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">{insight.suggested_action}</p>
      </div>
    </div>
  )
}
