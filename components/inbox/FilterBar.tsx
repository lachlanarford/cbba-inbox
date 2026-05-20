'use client'

import { useUsers } from '@/lib/hooks/useUsers'
import type { InboxFilters } from '@/types/database'

const STATUS_TABS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting',     label: 'Waiting' },
  { value: 'closed',      label: 'Closed' },
  { value: 'all',         label: 'All' },
]

const DEPARTMENTS = ['Reps', 'Comps', 'LTP', 'Other']
const PRIORITIES  = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]
const CHANNELS = [
  { value: 'gmail',     label: 'Gmail' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'form',      label: 'Form' },
  { value: 'chat',      label: 'Chat' },
]

interface FilterBarProps {
  filters: InboxFilters
  onFilterChange: <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => void
  onClearAll: () => void
}

export default function FilterBar({ filters, onFilterChange, onClearAll }: FilterBarProps) {
  const users = useUsers()

  const activeChips: Array<{ key: keyof InboxFilters; label: string }> = []
  if (filters.department) activeChips.push({ key: 'department', label: filters.department })
  if (filters.priority)   activeChips.push({ key: 'priority',   label: capitalize(filters.priority) })
  if (filters.channel)    activeChips.push({ key: 'channel',    label: capitalize(filters.channel) })
  if (filters.assignedTo) {
    const user = users.find((u) => u.id === filters.assignedTo)
    activeChips.push({ key: 'assignedTo', label: user?.full_name ?? 'Assigned' })
  }

  const hasActiveFilters = activeChips.length > 0 || filters.search !== ''

  return (
    <div className="flex-shrink-0 border-b border-white/5">
      {/* Status tabs */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onFilterChange('status', tab.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filters.status === tab.value
                ? 'bg-cbba-purple text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-1.5">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors"
          />
        </div>
      </div>

      {/* Filter dropdowns */}
      <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
        <FilterSelect
          placeholder="Department"
          value={filters.department}
          onChange={(v) => onFilterChange('department', v)}
          options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
        />
        <FilterSelect
          placeholder="Priority"
          value={filters.priority}
          onChange={(v) => onFilterChange('priority', v)}
          options={PRIORITIES}
        />
        <FilterSelect
          placeholder="Channel"
          value={filters.channel}
          onChange={(v) => onFilterChange('channel', v)}
          options={CHANNELS}
        />
        <FilterSelect
          placeholder="Assigned to"
          value={filters.assignedTo}
          onChange={(v) => onFilterChange('assignedTo', v)}
          options={users.map((u) => ({ value: u.id, label: u.full_name ?? u.email }))}
        />
      </div>

      {/* Active chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-cbba-purple/20 text-cbba-purple border border-cbba-purple/30 rounded-full text-xs"
            >
              {chip.label}
              <button
                onClick={() => onFilterChange(chip.key, '')}
                className="hover:text-white transition-colors"
                aria-label={`Remove ${chip.label} filter`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cbba-purple/20 text-cbba-purple border border-cbba-purple/30 rounded-full text-xs">
              &ldquo;{filters.search}&rdquo;
              <button onClick={() => onFilterChange('search', '')} className="hover:text-white transition-colors" aria-label="Remove search filter">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
          <button onClick={onClearAll} className="text-xs text-gray-500 hover:text-white transition-colors ml-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs px-2 py-1 rounded-lg border transition-colors focus:outline-none focus:border-cbba-purple cursor-pointer ${
        value
          ? 'bg-cbba-purple/20 border-cbba-purple/40 text-white'
          : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
      }`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
