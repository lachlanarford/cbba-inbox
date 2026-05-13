import type { Priority } from '@/types/database'

const PRIORITY_CONFIG: Record<Priority, { label: string; dotClass: string; textClass: string }> = {
  low:    { label: 'Low',    dotClass: 'bg-gray-400',   textClass: 'text-gray-400' },
  medium: { label: 'Medium', dotClass: 'bg-blue-400',   textClass: 'text-blue-400' },
  high:   { label: 'High',   dotClass: 'bg-orange-400', textClass: 'text-orange-400' },
  urgent: { label: 'Urgent', dotClass: 'bg-red-400',    textClass: 'text-red-400' },
}

interface PriorityBadgeProps {
  priority: string
  showLabel?: boolean
}

export default function PriorityBadge({ priority, showLabel }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority as Priority] ?? {
    label: priority,
    dotClass: 'bg-gray-400',
    textClass: 'text-gray-400',
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dotClass}`} />
      {showLabel && <span className={`text-xs ${config.textClass}`}>{config.label}</span>}
    </span>
  )
}
