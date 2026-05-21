'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { buildParams, type ReportFilters } from './DateRangeFilter'

interface HourData {
  hour: string
  count: number
}

export default function BusiestHoursCard({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<HourData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/busiest-hours?${buildParams(filters)}`)
      .then((r) => r.json())
      .then((d: HourData[]) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  const maxCount = data.reduce((a, b) => Math.max(a, b.count), 0)

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Busiest Hours</h3>
        <p className="text-xs text-gray-500 mt-0.5">Conversations by hour of day (UTC)</p>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : maxCount === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">No data for this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 9, fill: '#6b7280' }}
              interval={3}
              tickFormatter={(v: string) => v.slice(0, 2)}
            />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
              itemStyle={{ fontSize: 11 }}
              cursor={{ fill: '#ffffff08' }}
              formatter={(v) => [v, 'Conversations']}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.count === maxCount ? '#FBB33F' : '#604484'}
                  fillOpacity={entry.count === maxCount ? 1 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
