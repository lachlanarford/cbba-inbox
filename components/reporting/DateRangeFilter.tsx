'use client'

import { useState } from 'react'

export interface DateRange {
  from: string
  to: string
  label: string
}

export interface ReportFilters {
  range: DateRange
  channel: string
  department: string
}

export function buildParams(filters: ReportFilters): string {
  const p = new URLSearchParams({ from: filters.range.from, to: filters.range.to })
  if (filters.channel) p.set('channel', filters.channel)
  if (filters.department) p.set('department', filters.department)
  return p.toString()
}

const PRESETS: DateRange[] = [
  { label: 'Last 7 days',  from: daysAgo(7),  to: today() },
  { label: 'Last 30 days', from: daysAgo(30), to: today() },
  { label: 'Last 90 days', from: daysAgo(90), to: today() },
  { label: 'This year',    from: thisYearStart(), to: today() },
]

function today(): string { return new Date().toISOString().slice(0, 10) }
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function thisYearStart(): string { return `${new Date().getFullYear()}-01-01` }

const CHANNELS = [
  { value: 'gmail',     label: 'Gmail' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'form',      label: 'Form' },
  { value: 'chat',      label: 'Chat' },
]
const DEPARTMENTS = [
  { value: 'Reps',  label: 'Reps' },
  { value: 'Comps', label: 'Comps' },
  { value: 'LTP',   label: 'Learn to Play' },
  { value: 'Other', label: 'Other' },
]

interface Props {
  filters: ReportFilters
  onChange: (filters: ReportFilters) => void
}

export default function DateRangeFilter({ filters, onChange }: Props) {
  const [customFrom, setCustomFrom] = useState(filters.range.label === 'Custom' ? filters.range.from : '')
  const [customTo, setCustomTo]     = useState(filters.range.label === 'Custom' ? filters.range.to   : '')

  function setRange(range: DateRange) {
    onChange({ ...filters, range })
  }

  function handleCustomFrom(v: string) {
    setCustomFrom(v)
    if (v && customTo) setRange({ label: 'Custom', from: v, to: customTo })
  }

  function handleCustomTo(v: string) {
    setCustomTo(v)
    if (customFrom && v) setRange({ label: 'Custom', from: customFrom, to: v })
  }

  const inputCls = (active: boolean) =>
    `text-xs px-2 py-1.5 rounded-lg border transition-colors focus:outline-none focus:border-[#604484] cursor-pointer ${
      active
        ? 'bg-[#604484]/20 border-[#604484]/40 text-white'
        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
    }`

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Date presets */}
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          onClick={() => { setRange(preset); setCustomFrom(''); setCustomTo('') }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filters.range.label === preset.label
              ? 'bg-[#604484] text-white'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {preset.label}
        </button>
      ))}

      {/* Custom date range */}
      <input
        type="date"
        value={customFrom}
        onChange={(e) => handleCustomFrom(e.target.value)}
        title="Custom from"
        className={inputCls(filters.range.label === 'Custom' && !!customFrom)}
      />
      <span className="text-gray-600 text-xs">to</span>
      <input
        type="date"
        value={customTo}
        onChange={(e) => handleCustomTo(e.target.value)}
        title="Custom to"
        className={inputCls(filters.range.label === 'Custom' && !!customTo)}
      />

      <span className="text-gray-700 mx-1">|</span>

      {/* Channel filter */}
      <select
        value={filters.channel}
        onChange={(e) => onChange({ ...filters, channel: e.target.value })}
        className={inputCls(!!filters.channel)}
      >
        <option value="">All channels</option>
        {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      {/* Department filter */}
      <select
        value={filters.department}
        onChange={(e) => onChange({ ...filters, department: e.target.value })}
        className={inputCls(!!filters.department)}
      >
        <option value="">All departments</option>
        {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
    </div>
  )
}

export { PRESETS }
