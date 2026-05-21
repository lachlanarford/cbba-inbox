'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { buildParams, type ReportFilters } from './DateRangeFilter'

interface VolumeData {
  data: Record<string, string | number>[]
  channels: string[]
}

const CHANNEL_COLORS: Record<string, string> = {
  gmail: '#ea4335',
  whatsapp: '#25d366',
  facebook: '#1877f2',
  instagram: '#e1306c',
  form: '#FBB33F',
  chat: '#604484',
  unknown: '#6b7280',
}

export default function VolumeByChannelCard({ filters }: { filters: ReportFilters }) {
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reporting/volume-by-channel?${buildParams(filters)}`)
      .then((r) => r.json())
      .then((d: VolumeData) => { setVolumeData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filters])

  return (
    <div className="bg-cbba-navy-light rounded-xl p-5 col-span-2">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Conversation Volume by Channel</h3>
        <p className="text-xs text-gray-500 mt-0.5">Daily incoming conversations per channel</p>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">Loading...</div>
      ) : !volumeData || volumeData.data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-600">No data for this period</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={volumeData.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#21222C', border: '1px solid #ffffff20', borderRadius: 8 }}
              itemStyle={{ fontSize: 11 }}
              cursor={{ fill: '#ffffff08' }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {volumeData.channels.map((ch) => (
              <Area
                key={ch}
                type="monotone"
                dataKey={ch}
                stackId="1"
                stroke={CHANNEL_COLORS[ch] ?? '#604484'}
                fill={CHANNEL_COLORS[ch] ?? '#604484'}
                fillOpacity={0.4}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
