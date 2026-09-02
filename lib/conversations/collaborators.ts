import { createServiceClient } from '@/lib/supabase/service'
import { notifyCollaboratorAdded } from '@/lib/push/send'

export interface CollaboratorRow {
  user_id: string
  added_by: string | null
  created_at: string
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
    email: string
  }
}

export async function listCollaborators(
  conversationId: string
): Promise<CollaboratorRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  const { data } = await supabase
    .from('conversation_collaborators')
    .select('user_id, added_by, created_at, user:users(id, full_name, avatar_url, email)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  return (data ?? []) as unknown as CollaboratorRow[]
}

export async function addCollaborator(opts: {
  conversationId: string
  userId: string
  addedBy: string | null
  subject: string | null
}): Promise<{ ok: boolean; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data: existing } = await supabase
    .from('conversation_collaborators')
    .select('user_id')
    .eq('conversation_id', opts.conversationId)
    .eq('user_id', opts.userId)
    .maybeSingle()

  if (existing) return { ok: true }

  const { error } = await supabase.from('conversation_collaborators').insert({
    conversation_id: opts.conversationId,
    user_id: opts.userId,
    added_by: opts.addedBy,
  })

  if (error) return { ok: false, error: error.message }

  await supabase.from('notifications').insert({
    user_id: opts.userId,
    type: 'collaborator',
    title: 'Added as collaborator',
    body: opts.subject ?? 'No subject',
    conversation_id: opts.conversationId,
  })

  notifyCollaboratorAdded(opts.userId, opts.subject, opts.conversationId).catch(() => {})

  return { ok: true }
}

export async function removeCollaborator(
  conversationId: string,
  userId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  await supabase
    .from('conversation_collaborators')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}

export async function notifyMentionedUsers(opts: {
  userIds: string[]
  authorId: string
  authorName: string
  conversationId: string
  subject: string | null
  excerpt: string
}): Promise<void> {
  const uniqueIds = Array.from(new Set(opts.userIds)).filter((id) => id !== opts.authorId)
  if (uniqueIds.length === 0) return

  const supabase = createServiceClient() as any
  await supabase.from('notifications').insert(
    uniqueIds.map((userId) => ({
      user_id: userId,
      type: 'mention',
      title: `${opts.authorName} mentioned you in a note`,
      body: opts.excerpt.slice(0, 120),
      conversation_id: opts.conversationId,
    }))
  )

  const { notifyMention } = await import('@/lib/push/send')
  for (const userId of uniqueIds) {
    notifyMention(userId, opts.authorName, opts.subject, opts.conversationId).catch(() => {})
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Auto-add staff users CC'd or BCC'd on a conversation so they see it in My Inbox. */
export async function autoAddStaffCollaborators(opts: {
  conversationId: string
  emails: string[]
  addedBy: string | null
  subject: string | null
  excludeEmails?: string[]
}): Promise<void> {
  const normalized = opts.emails
    .map(normalizeEmail)
    .filter(Boolean)
    .filter((e) => !(opts.excludeEmails ?? []).map(normalizeEmail).includes(e))

  if (normalized.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data: staffUsers } = await supabase
    .from('users')
    .select('id, email')
    .eq('is_active', true)

  const emailToUserId = new Map<string, string>()
  for (const u of staffUsers ?? []) {
    if (u.email) emailToUserId.set(normalizeEmail(u.email), u.id)
  }

  const userIds = Array.from(new Set(
    normalized
      .map((e) => emailToUserId.get(e))
      .filter((id): id is string => !!id && id !== opts.addedBy)
  ))

  for (const userId of userIds) {
    await addCollaborator({
      conversationId: opts.conversationId,
      userId,
      addedBy: opts.addedBy,
      subject: opts.subject,
    })
  }
}

export async function getConversationWatcherIds(
  conversationId: string,
  excludeUserIds: string[] = []
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any

  const { data: conv } = await supabase
    .from('conversations')
    .select('assigned_to')
    .eq('id', conversationId)
    .single()

  const { data: collabs } = await supabase
    .from('conversation_collaborators')
    .select('user_id')
    .eq('conversation_id', conversationId)

  const exclude = new Set(excludeUserIds)
  const ids = new Set<string>()
  if (conv?.assigned_to && !exclude.has(conv.assigned_to)) {
    ids.add(conv.assigned_to)
  }
  for (const row of collabs ?? []) {
    if (!exclude.has(row.user_id)) ids.add(row.user_id)
  }
  return Array.from(ids)
}

/** Notify assignee and collaborators about new activity on a conversation. */
export async function notifyConversationWatchers(opts: {
  conversationId: string
  excludeUserIds?: string[]
  type: 'message' | 'note'
  title: string
  body: string
  senderName?: string
  subject?: string | null
  pushTitle?: string
  pushAuthorName?: string
}): Promise<void> {
  const userIds = await getConversationWatcherIds(
    opts.conversationId,
    opts.excludeUserIds ?? []
  )
  if (userIds.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any
  await supabase.from('notifications').insert(
    userIds.map((userId) => ({
      user_id: userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      conversation_id: opts.conversationId,
    }))
  )

  if (opts.type === 'message') {
    const { notifyNewMessage, sendPushToUsers } = await import('@/lib/push/send')
    if (opts.pushTitle) {
      sendPushToUsers(userIds, {
        title: opts.pushTitle,
        body: opts.subject ?? opts.body,
        url: `/inbox?conversation=${opts.conversationId}`,
        conversationId: opts.conversationId,
      }).catch(() => {})
    } else if (opts.senderName) {
      notifyNewMessage(
        userIds,
        opts.senderName,
        opts.subject ?? null,
        opts.conversationId
      ).catch(() => {})
    }
  } else if (opts.type === 'note' && opts.pushAuthorName) {
    const { notifyInternalNote } = await import('@/lib/push/send')
    notifyInternalNote(
      userIds,
      opts.pushAuthorName,
      opts.subject ?? null,
      opts.conversationId
    ).catch(() => {})
  }
}
