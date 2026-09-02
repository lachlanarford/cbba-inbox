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
  addedBy: string
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
