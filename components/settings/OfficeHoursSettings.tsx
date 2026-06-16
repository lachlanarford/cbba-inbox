'use client'

import { useState, useTransition } from 'react'

interface Props {
  initialEnabled: boolean
  initialStart: string
  initialEnd: string
  initialDays: string
  initialTimezone: string
}

const DAY_OPTIONS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
]

const TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Hobart',
  'Pacific/Auckland',
  'UTC',
]

export default function OfficeHoursSettings({ initialEnabled, initialStart, initialEnd, initialDays, initialTimezone }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [timezone, setTimezone] = useState(initialTimezone)
  const [savedMsg, setSavedMsg] = useState('')
  const [isSaving, startSave] = useTransition()

  const activeDays = new Set(initialDays.split(',').map(Number).filter(Boolean))
  const [days, setDays] = useState<Set<number>>(activeDays)

  function toggleDay(day: number) {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  function save() {
    startSave(async () => {
      const res = await fetch('/api/settings/office-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          start,
          end,
          days: Array.from(days).sort().join(','),
          timezone,
        }),
      })
      setSavedMsg(res.ok ? 'Saved.' : 'Error saving.')
      setTimeout(() => setSavedMsg(''), 2500)
    })
  }

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Office hours restriction</p>
          <p className="text-xs text-gray-500 mt-0.5">Outside these hours the chat widget will use AI mode regardless of staff live chat status</p>
        </div>
        <button
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-cbba-purple' : 'bg-white/10'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {enabled && (
        <>
          {/* Days */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Active days</p>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => toggleDay(d.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    days.has(d.value) ? 'bg-cbba-purple text-white' : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Open time</label>
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cbba-purple"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Close time</label>
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cbba-purple"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cbba-purple"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-cbba-purple text-white text-sm font-medium disabled:opacity-50 hover:bg-cbba-purple-light transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        {savedMsg && <span className="text-xs text-green-400">{savedMsg}</span>}
      </div>
    </div>
  )
}
