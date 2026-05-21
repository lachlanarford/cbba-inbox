'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { buildParams, type ReportFilters } from './DateRangeFilter'

interface DataPoint {
  name: string
  value: number
  color: string
}

export default function PriorityDistributionCard({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/priority-distribution?${buildParams(filters)}`)
      .then((r) => r.json())
      .then((d: DataPoint[]) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  const total = data.reduce((a, b) => a + b.value, 0)

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Priority Breakdown</h3>
        <p className="text-xs text-gray-500 mt-0.5">Conversations by priority level</p>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : total === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">No data for this period</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={data.filter((d) => d.value > 0)}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {data
                  .filter((d) => d.value > 0)
                  .map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
                itemStyle={{ fontSize: 11 }}
                formatter={(v) => [
                  `${v} (${total > 0 ? Math.round((Number(v) / total) * 100) : 0}%)`,
                  '',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
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
