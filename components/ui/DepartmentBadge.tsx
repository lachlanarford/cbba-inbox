import type { Department } from '@/types/database'

const DEPT_CONFIG: Record<Department, string> = {
  Reps:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Comps: 'bg-green-500/15 text-green-400 border-green-500/20',
  LTP:   'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Other: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
}

export default function DepartmentBadge({ department }: { department: string | null }) {
  if (!department) return null
  const classes = DEPT_CONFIG[department as Department] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${classes}`}>
      {department}
    </span>
  )
}
