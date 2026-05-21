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
  ReferenceLine,
} from 'recharts'
import { buildParams, type ReportFilters } from './DateRangeFilter'

interface WeeklyPoint {
  week: string
  avg: number
  count: number
}

interface FeedbackData {
  weekly: WeeklyPoint[]
  overall: number | null
  total: number
  distribution: Record<number, number>
}

export default function FeedbackScoresCard({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<FeedbackData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/feedback-scores?${buildParams(filters)}`)
      .then((r) => r.json())
      .then((d: FeedbackData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  const isEmpty = !data || data.total === 0

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5 col-span-2">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Feedback Scores</h3>
          <p className="text-xs text-gray-500 mt-0.5">Ratings from closed conversations</p>
        </div>
        {data?.overall != null && (
          <div className="text-right">
            <span className="text-3xl font-bold text-[#FBB33F]">{data.overall}</span>
            <span className="text-xs text-gray-500 block">out of 5</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-44 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : isEmpty ? (
        <div className="h-44 flex items-center justify-center text-xs text-gray-600">No feedback received yet</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: distribution */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = data.distribution[star] ?? 0
              const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-[#FBB33F] w-6 flex-shrink-0">{star}★</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: star >= 4 ? '#4ade80' : star === 3 ? '#FBB33F' : '#f87171',
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{count}</span>
                  <span className="text-xs text-gray-600 w-8 flex-shrink-0">{pct}%</span>
                </div>
              )
            })}
            <p className="text-xs text-gray-600 pt-2">{data.total} total responses</p>
          </div>

          {/* Right: weekly trend */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Weekly avg</p>
            <ResponsiveContainer width="100%" height={152}>
              <LineChart data={data.weekly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                <Tooltip
                  contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
                  itemStyle={{ fontSize: 11 }}
                  formatter={(v, _name, props) => [
                    `${v} / 5 (${(props.payload as WeeklyPoint | undefined)?.count ?? 0} responses)`,
                    'Avg rating',
                  ]}
                  labelFormatter={(v) => `Week of ${v}`}
                />
                <ReferenceLine y={3} stroke="#ffffff15" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#FBB33F"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#FBB33F', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#FBB33F' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
