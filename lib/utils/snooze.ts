export type SnoozePreset = '1h' | 'later' | 'tomorrow' | 'week'

export function snoozeUntil(preset: SnoozePreset, from = new Date()): Date {
  const d = new Date(from)
  if (preset === '1h') {
    d.setHours(d.getHours() + 1)
  } else if (preset === 'later') {
    d.setHours(17, 0, 0, 0)
    if (d <= from) d.setDate(d.getDate() + 1)
  } else if (preset === 'tomorrow') {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  } else if (preset === 'week') {
    d.setDate(d.getDate() + 7)
    d.setHours(9, 0, 0, 0)
  }
  return d
}

export function formatSnoozeUntil(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d <= now) return 'Expired'
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Until ${time} today`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) {
    return `Until ${time} tomorrow`
  }
  return `Until ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`
}
