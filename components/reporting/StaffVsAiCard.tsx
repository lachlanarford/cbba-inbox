'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { DateRange } from './DateRangeFilter'

interface DataPoint {
  name: string
  value: number
}

const COLORS = ['#604484', '#FBB33F']

export default function StaffVsAiCard({ range }: { range: DateRange }) {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/staff-vs-ai?from=${range.from}&to=${range.to}`)
      .then((r) => r.json())
      .then((d: DataPoint[]) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range.from, range.to])

  const total = data.reduce((a, b) => a + b.value, 0)

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Staff vs AI Replies</h3>
        <p className="text-xs text-gray-500 mt-0.5">Message breakdown by sender</p>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : total === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">No data for this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((_entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
              itemStyle={{ fontSize: 11 }}
              formatter={(v, name) => [
                `${v} (${total > 0 ? Math.round((Number(v) / total) * 100) : 0}%)`,
                name,
              ]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
