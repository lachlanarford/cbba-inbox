export type PushCategory =
  | 'assignments'
  | 'messages'
  | 'mentions'
  | 'notes'
  | 'collaborators'
  | 'live_chat'

export interface PushPreferences {
  assignments?: boolean
  messages?: boolean
  mentions?: boolean
  notes?: boolean
  collaborators?: boolean
  live_chat?: boolean
}

export const DEFAULT_PUSH_PREFERENCES: Required<PushPreferences> = {
  assignments: true,
  messages: true,
  mentions: true,
  notes: true,
  collaborators: true,
  live_chat: true,
}

export function isPushEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false
  return (settings as Record<string, unknown>).push_enabled === true
}

export function getPushPreferences(settings: unknown): Required<PushPreferences> {
  const raw = (settings as Record<string, unknown> | null)?.push_preferences
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PUSH_PREFERENCES }
  const prefs = raw as PushPreferences
  return {
    assignments: prefs.assignments !== false,
    messages: prefs.messages !== false,
    mentions: prefs.mentions !== false,
    notes: prefs.notes !== false,
    collaborators: prefs.collaborators !== false,
    live_chat: prefs.live_chat !== false,
  }
}

export function isPushCategoryEnabled(settings: unknown, category: PushCategory): boolean {
  if (!isPushEnabled(settings)) return false
  return getPushPreferences(settings)[category]
}
