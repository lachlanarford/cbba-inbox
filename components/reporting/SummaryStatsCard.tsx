'use client'

import { useEffect, useState } from 'react'
import { buildParams, type ReportFilters } from './DateRangeFilter'

interface SummaryData {
  total: number
  closed: number
  closedRate: number
  avgResponseHours: number | null
  avgRating: number | null
  appInitiated: number
}

export default function SummaryStatsCard({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/summary?${buildParams(filters)}`)
      .then((r) => r.json())
      .then((d: SummaryData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  const stats = [
    {
      label: 'Total Conversations',
      value: loading ? '-' : String(data?.total ?? 0),
      color: '#604484',
    },
    {
      label: 'Closed',
      value: loading ? '-' : String(data?.closed ?? 0),
      color: '#4ade80',
    },
    {
      label: 'Close Rate',
      value: loading ? '-' : `${data?.closedRate ?? 0}%`,
      color: '#4ade80',
    },
    {
      label: 'Avg Response Time',
      value: loading ? '-' : data?.avgResponseHours != null ? `${data.avgResponseHours}h` : 'N/A',
      color: '#FBB33F',
    },
    {
      label: 'Avg Rating',
      value: loading ? '-' : data?.avgRating != null ? `${data.avgRating}/5` : 'N/A',
      color: '#FBB33F',
    },
    {
      label: 'Staff Initiated',
      value: loading ? '-' : String(data?.appInitiated ?? 0),
      subtitle: 'Conversations started by staff',
      color: '#F58945',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-cbba-navy-light rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">{s.label}</p>
          <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          {'subtitle' in s && s.subtitle && (
            <p className="text-xs text-gray-600 mt-1">{s.subtitle}</p>
          )}
        </div>
      ))}
    </div>
  )
}
