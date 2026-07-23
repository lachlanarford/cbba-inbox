import type { ConversationStatus } from '@/types/database'

const STATUS_CONFIG: Record<ConversationStatus, { label: string; classes: string }> = {
  open:        { label: 'Open',        classes: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  in_progress: { label: 'In Progress', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  waiting:     { label: 'Waiting',     classes: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  closed:      { label: 'Closed',      classes: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
}

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as ConversationStatus] ?? {
    label: status,
    classes: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${config.classes}`}>
      {config.label}
    </span>
  )
}
