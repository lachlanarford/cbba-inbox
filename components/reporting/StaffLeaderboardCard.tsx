'use client'

import { useEffect, useState } from 'react'
import { buildParams, type ReportFilters } from './DateRangeFilter'

interface StaffRow {
  id: string
  name: string
  avatar_url: string | null
  total: number
  closed: number
  messages: number
  chatMins: number
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function StaffLeaderboardCard({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/staff-leaderboard?${buildParams(filters)}`)
      .then((r) => r.json())
      .then((d: StaffRow[]) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5 col-span-2">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Staff Leaderboard</h3>
        <p className="text-xs text-gray-500 mt-0.5">Based on who sent replies, not the From inbox address</p>
      </div>
      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-600">No data for this period</div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-2 mb-1">
            <span className="text-xs text-gray-600">Member</span>
            <span className="text-xs text-gray-600 w-14 text-right">Handled</span>
            <span className="text-xs text-gray-600 w-14 text-right">Closed</span>
            <span className="text-xs text-gray-600 w-16 text-right">Replies</span>
            <span className="text-xs text-gray-600 w-16 text-right">Live Chat</span>
          </div>
          {data.slice(0, 8).map((row, i) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-600 w-4 flex-shrink-0">{i + 1}</span>
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0 object-cover" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#604484]/40 flex items-center justify-center text-xs text-white flex-shrink-0">
                    {row.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-xs text-white truncate">{row.name}</span>
              </div>
              <span className="text-xs text-white w-14 text-right">{row.total}</span>
              <span className="text-xs text-[#4ade80] w-14 text-right">{row.closed}</span>
              <span className="text-xs text-gray-400 w-16 text-right">{row.messages}</span>
              <span className="text-xs text-[#FBB33F] w-16 text-right">{formatMins(row.chatMins)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
