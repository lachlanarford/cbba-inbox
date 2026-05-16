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
import type { DateRange } from './DateRangeFilter'

interface DataPoint {
  name: string
  value: number
}

const DEPT_COLORS: Record<string, string> = {
  Reps: '#604484',
  Comps: '#FBB33F',
  LTP: '#F58945',
  Other: '#60a5fa',
  Unassigned: '#6b7280',
}

export default function CategoryDistributionCard({ range }: { range: DateRange }) {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/category-distribution?from=${range.from}&to=${range.to}`)
      .then((r) => r.json())
      .then((d: DataPoint[]) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range.from, range.to])

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Category Distribution</h3>
        <p className="text-xs text-gray-500 mt-0.5">Conversations by department</p>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">No data for this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
              itemStyle={{ fontSize: 11 }}
              cursor={{ fill: '#ffffff08' }}
            />
            <Bar dataKey="value" name="Conversations" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={DEPT_COLORS[entry.name] ?? '#604484'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
