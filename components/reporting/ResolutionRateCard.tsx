'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { DateRange } from './DateRangeFilter'

interface ResolutionData {
  counts: Record<string, number>
  total: number
  closed_rate: number
  breakdown: { name: string; value: number; color: string }[]
}

export default function ResolutionRateCard({ range }: { range: DateRange }) {
  const [data, setData] = useState<ResolutionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/resolution-rate?from=${range.from}&to=${range.to}`)
      .then((r) => r.json())
      .then((d: ResolutionData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range.from, range.to])

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Resolution Rate</h3>
          <p className="text-xs text-gray-500 mt-0.5">% of conversations closed</p>
        </div>
        {data && (
          <span className="text-2xl font-bold text-[#4ade80]">{data.closed_rate}%</span>
        )}
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : !data || data.total === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">No data for this period</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={data.breakdown.filter((d) => d.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {data.breakdown
                  .filter((d) => d.value > 0)
                  .map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
                itemStyle={{ fontSize: 11 }}
                formatter={(v, name) => [
                  `${v} (${data.total > 0 ? Math.round((Number(v) / data.total) * 100) : 0}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {data.breakdown.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: item.color }}
                />
                <span className="text-xs text-gray-500">{item.name}</span>
                <span className="text-xs text-white ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
