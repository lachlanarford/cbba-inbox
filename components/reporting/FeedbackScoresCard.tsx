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

  const starDisplay = data?.overall
    ? '★'.repeat(Math.round(data.overall)) + '☆'.repeat(5 - Math.round(data.overall))
    : null

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Feedback Scores</h3>
          <p className="text-xs text-gray-500 mt-0.5">Average rating from closed conversations</p>
        </div>
        {data?.overall && (
          <div className="text-right">
            <span className="text-2xl font-bold text-[#FBB33F]">{data.overall}</span>
            <span className="text-xs text-gray-500 block">{starDisplay}</span>
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : !data || data.total === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-gray-600">No feedback received yet</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.weekly} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={[0, 5]} />
              <Tooltip
                contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
                itemStyle={{ fontSize: 11 }}
                cursor={{ fill: '#ffffff08' }}
                formatter={(v, _name, props) => [
                  `${v} / 5 (${(props.payload as WeeklyPoint | undefined)?.count ?? 0} responses)`,
                  'Avg rating',
                ]}
              />
              <ReferenceLine y={3} stroke="#ffffff20" strokeDasharray="4 4" />
              <Bar dataKey="avg" name="Avg rating" fill="#604484" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-600 mt-2 text-right">{data.total} total responses</p>
        </>
      )}
    </div>
  )
}
