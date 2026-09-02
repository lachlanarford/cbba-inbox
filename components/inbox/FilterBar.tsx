'use client'

import { useState, useRef, useEffect } from 'react'
import { useUsers } from '@/lib/hooks/useUsers'
import type { InboxFilters } from '@/types/database'

const STATUS_TABS = [
  { value: 'open',   label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all',    label: 'All' },
]

const DEPARTMENTS = [
  { value: 'Reps',  label: 'Reps' },
  { value: 'Comps', label: 'Comps' },
  { value: 'LTP',   label: 'Learn to Play' },
  { value: 'Referees', label: 'Referees' },
  { value: 'Other', label: 'Other' },
]
const PRIORITIES = [
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
  filtersOpen: boolean
  onInboxViewChange: (view: 'mine' | 'all') => void
}

export default function FilterBar({
  filters,
  onFilterChange,
  onClearAll,
  filtersOpen,
  onInboxViewChange,
}: FilterBarProps) {
  const users = useUsers()
  const [gmailAccounts, setGmailAccounts] = useState<Array<{ id: string; identifier: string }>>([])

  useEffect(() => {
    fetch('/api/channel-configs/gmail')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ id: string; identifier: string }>) => {
        setGmailAccounts(Array.isArray(data) ? data : [])
      })
      .catch(() => setGmailAccounts([]))
  }, [])

  const hasActiveFilters =
    filters.search !== '' ||
    filters.email !== '' ||
    filters.department !== '' ||
    filters.priority !== '' ||
    filters.channel !== '' ||
    filters.channelConfigId !== '' ||
    filters.assignedTo !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== ''

  return (
    <div className="flex-shrink-0 border-b border-white/5">
      {/* Inbox view: My Inbox vs All */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <button
          onClick={() => onInboxViewChange('mine')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out whitespace-nowrap ${
            filters.myInbox
              ? 'bg-cbba-gold/20 text-cbba-gold border border-cbba-gold/30'
              : 'text-gray-400 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/5'
          }`}
        >
          My Inbox
        </button>
        <button
          onClick={() => onInboxViewChange('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out whitespace-nowrap ${
            !filters.myInbox
              ? 'bg-white/10 text-white'
              : 'text-gray-400 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/5'
          }`}
        >
          All Conversations
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onFilterChange('status', tab.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out whitespace-nowrap ${
              filters.status === tab.value
                ? 'bg-cbba-purple text-white'
                : 'text-gray-400 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Collapsible search + filter pills */}
      {filtersOpen && (
        <>
          <div className="px-3 pb-1.5 space-y-1.5">
            <SearchInput
              icon="search"
              placeholder="Search by name or subject..."
              value={filters.search}
              onChange={(v) => onFilterChange('search', v)}
            />
            <SearchInput
              icon="email"
              placeholder="Filter by email..."
              value={filters.email}
              onChange={(v) => onFilterChange('email', v)}
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 pb-2.5 flex-wrap">
            <FilterPill
              label="Department"
              value={filters.department}
              onChange={(v) => onFilterChange('department', v)}
              options={DEPARTMENTS}
            />
            <FilterPill
              label="Priority"
              value={filters.priority}
              onChange={(v) => onFilterChange('priority', v)}
              options={PRIORITIES}
            />
            <FilterPill
              label="Channel"
              value={filters.channel}
              onChange={(v) => onFilterChange('channel', v)}
              options={CHANNELS}
            />
            {!filters.myInbox && (
              <FilterPill
                label="Assigned to"
                value={filters.assignedTo}
                onChange={(v) => onFilterChange('assignedTo', v)}
                options={users.map((u) => ({ value: u.id, label: u.full_name ?? u.email }))}
              />
            )}
            {gmailAccounts.length > 1 && (
              <FilterPill
                label="Email account"
                value={filters.channelConfigId}
                onChange={(v) => onFilterChange('channelConfigId', v)}
                options={gmailAccounts.map((a) => ({ value: a.id, label: a.identifier }))}
              />
            )}
            <DateRangePill
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onFromChange={(v) => onFilterChange('dateFrom', v)}
              onToChange={(v) => onFilterChange('dateTo', v)}
            />
            {hasActiveFilters && (
              <button
                onClick={onClearAll}
                className="text-xs text-gray-500 hover:text-white transition-colors px-1 ml-auto"
              >
                Clear all
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SearchInput({
  icon,
  placeholder,
  value,
  onChange,
}: {
  icon: 'search' | 'email'
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none">
        {icon === 'search' ? (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
        ) : (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )}
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

function FilterPill({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selectedLabel = options.find((o) => o.value === value)?.label

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full text-xs border active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-150 ease-out whitespace-nowrap ${
          value
            ? 'bg-cbba-purple/20 border-cbba-purple/40 text-white'
            : 'bg-white/5 border-white/10 text-gray-400 [@media(hover:hover)]:hover:border-white/25 [@media(hover:hover)]:hover:text-gray-200'
        }`}
      >
        <span>{value ? selectedLabel : label}</span>
        {value ? (
          <span
            onClick={(e) => { e.stopPropagation(); onChange('') }}
            className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        ) : (
          <svg
            className={`w-3 h-3 transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 bg-cbba-navy-dark border border-white/10 rounded-xl shadow-2xl py-1 min-w-[140px] max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-[background-color,color] duration-150 ease-out [@media(hover:hover)]:hover:bg-white/5 ${
                value === opt.value ? 'text-cbba-purple font-medium' : 'text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DateRangePill({
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
}: {
  dateFrom: string
  dateTo: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hasDate = dateFrom || dateTo

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function pillLabel() {
    if (dateFrom && dateTo) return `${dateFrom} - ${dateTo}`
    if (dateFrom) return `From ${dateFrom}`
    if (dateTo) return `To ${dateTo}`
    return 'Last activity'
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full text-xs border transition-colors whitespace-nowrap ${
          hasDate
            ? 'bg-cbba-purple/20 border-cbba-purple/40 text-white'
            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/25 hover:text-gray-200'
        }`}
      >
        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span>{pillLabel()}</span>
        {hasDate ? (
          <span
            onClick={(e) => { e.stopPropagation(); onFromChange(''); onToChange('') }}
            className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        ) : (
          <svg
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 bg-cbba-navy-dark border border-white/10 rounded-xl shadow-2xl p-3 min-w-[200px]">
          <p className="text-[10px] text-gray-500 mb-2">Filter by last activity</p>
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onFromChange(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cbba-purple transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onToChange(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-cbba-purple transition-colors"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
