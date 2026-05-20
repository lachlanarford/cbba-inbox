'use client'

import { useState, useEffect } from 'react'

interface BugReport {
  id: string
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved'
  priority: 'low' | 'medium' | 'high'
  created_at: string
  submitted_by_user: { full_name: string | null; email: string } | null
}

const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' }
const STATUS_CLASSES = {
  open: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  resolved: 'bg-green-500/15 text-green-400 border-green-500/20',
}
const PRIORITY_CLASSES = {
  low: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/15 text-red-400 border-red-500/20',
}

export default function BugReportsAdmin() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/bug-reports')
      .then((r) => r.json())
      .then((d: BugReport[]) => { setReports(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/bug-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: status as BugReport['status'] } : r))
    }
  }

  if (loading) return <div className="text-xs text-gray-500 py-4">Loading...</div>

  if (reports.length === 0) {
    return <p className="text-sm text-gray-500 py-4">No bug reports yet.</p>
  }

  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="bg-cbba-navy-dark border border-white/10 rounded-xl overflow-hidden">
          <div
            className="flex items-start justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{r.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.submitted_by_user?.full_name ?? r.submitted_by_user?.email ?? 'Unknown'} &middot; {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${PRIORITY_CLASSES[r.priority]}`}>
                {r.priority}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_CLASSES[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
              <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded === r.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {expanded === r.id && (
            <div className="px-4 pb-4 border-t border-white/5">
              <p className="text-xs text-gray-300 mt-3 whitespace-pre-wrap leading-relaxed">{r.description}</p>
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs text-gray-500">Update status:</span>
                {(['open', 'in_progress', 'resolved'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(r.id, s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      r.status === s
                        ? STATUS_CLASSES[s]
                        : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
