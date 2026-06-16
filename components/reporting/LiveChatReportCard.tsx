'use client'

import { useState, useEffect } from 'react'
import type { ReportFilters } from './DateRangeFilter'

interface LiveChatRow {
  user: { id: string; full_name: string | null; avatar_url: string | null }
  total_seconds: number
  session_count: number
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return '<1m'
}

export default function LiveChatReportCard({ filters }: { filters: ReportFilters }) {
  const [rows, setRows] = useState<LiveChatRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      from: filters.range.from,
      to: filters.range.to,
    })
    fetch(`/api/reports/live-chat?${params}`)
      .then((r) => r.json())
      .then((d: { rows?: LiveChatRow[] }) => { setRows(d.rows ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  return (
    <div className="bg-cbba-navy-dark border border-white/10 rounded-xl col-span-1">
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
          <p className="text-sm font-semibold text-white">Live Chat Usage</p>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{filters.range.label}</p>
      </div>

      <div className="p-5">
        {loading ? (
          <p className="text-xs text-gray-600 text-center py-4">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">No live chat sessions in this period</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const initials = (row.user.full_name ?? '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <div key={row.user.id} className="flex items-center gap-3">
                  {row.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-cbba-purple/20 flex items-center justify-center text-[10px] font-bold text-cbba-purple flex-shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-white truncate">{row.user.full_name ?? 'Unknown'}</p>
                      <p className="text-xs text-white font-medium ml-2 flex-shrink-0">{formatDuration(row.total_seconds)}</p>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[10px] text-gray-500">{row.session_count} session{row.session_count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
