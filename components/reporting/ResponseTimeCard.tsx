'use client'

import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { buildParams, type ReportFilters } from './DateRangeFilter'

interface DataPoint {
  date: string
  avg_hours: number
}

export default function ResponseTimeCard({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/response-time?${buildParams(filters)}`)
      .then((r) => r.json())
      .then((d: DataPoint[]) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  const avg =
    data.length > 0
      ? Math.round((data.reduce((a, b) => a + b.avg_hours, 0) / data.length) * 10) / 10
      : null

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Avg. Response Time</h3>
          <p className="text-xs text-gray-500 mt-0.5">Hours to first reply</p>
        </div>
        {avg !== null && (
          <span className="text-2xl font-bold text-[#FBB33F]">{avg}h</span>
        )}
      </div>
      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-600">No data for this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
            <Tooltip
              contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af', fontSize: 11 }}
              itemStyle={{ color: '#FBB33F', fontSize: 11 }}
              formatter={(v) => [`${v}h`, 'Avg time']}
            />
            <Line
              type="monotone"
              dataKey="avg_hours"
              stroke="#604484"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#FBB33F' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
