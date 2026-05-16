'use client'

export interface DateRange {
  from: string
  to: string
  label: string
}

const PRESETS: DateRange[] = [
  { label: 'Last 7 days', from: daysAgo(7), to: today() },
  { label: 'Last 30 days', from: daysAgo(30), to: today() },
  { label: 'Last 90 days', from: daysAgo(90), to: today() },
  { label: 'This year', from: thisYearStart(), to: today() },
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function thisYearStart(): string {
  return `${new Date().getFullYear()}-01-01`
}

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
}

export default function DateRangeFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          onClick={() => onChange(preset)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value.label === preset.label
              ? 'bg-[#604484] text-white'
              : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}

export { PRESETS }
