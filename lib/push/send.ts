import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'
import {
  type PushCategory,
  isPushEnabled,
  isPushCategoryEnabled,
} from '@/lib/push/preferences'

export type { PushCategory, PushPreferences } from '@/lib/push/preferences'
export { DEFAULT_PUSH_PREFERENCES, getPushPreferences } from '@/lib/push/preferences'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? ''
)

export interface PushPayload {
  title: string
  body: string
  url?: string
  conversationId?: string
}

async function getSubscriptionsForUsers(userIds: string[], category?: PushCategory) {
  if (userIds.length === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: users } = await db
    .from('users')
    .select('id, settings')
    .in('id', userIds)
    .eq('is_active', true)

  const enabledIds = (users ?? [])
    .filter((u: { id: string; settings: unknown }) =>
      category ? isPushCategoryEnabled(u.settings, category) : isPushEnabled(u.settings)
    )
    .map((u: { id: string }) => u.id)

  if (enabledIds.length === 0) return []

  const { data: rows } = await db
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .in('user_id', enabledIds)

  return (rows ?? []) as Array<{ endpoint: string; subscription: webpush.PushSubscription }>
}

async function sendToSubscriptions(
  rows: Array<{ endpoint: string; subscription: webpush.PushSubscription }>,
  payload: PushPayload
): Promise<void> {
  if (rows.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const json = JSON.stringify(payload)

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, json)
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
        }
      }
    })
  )
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  category?: PushCategory
): Promise<void> {
  const rows = await getSubscriptionsForUsers(userIds, category)
  await sendToSubscriptions(rows, payload)
}

export async function sendPushToAll(payload: PushPayload, category?: PushCategory): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: users } = await db
    .from('users')
    .select('id, settings')
    .eq('is_active', true)

  const enabledIds = (users ?? [])
    .filter((u: { id: string; settings: unknown }) =>
      category ? isPushCategoryEnabled(u.settings, category) : isPushEnabled(u.settings)
    )
    .map((u: { id: string }) => u.id)

  if (enabledIds.length === 0) return

  const { data: rows } = await db
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .in('user_id', enabledIds)

  await sendToSubscriptions((rows ?? []) as Array<{ endpoint: string; subscription: webpush.PushSubscription }>, payload)
}

export async function notifyAssignment(
  userId: string,
  subject: string | null,
  conversationId: string
): Promise<void> {
  await sendPushToUsers([userId], {
    title: 'Conversation assigned to you',
    body: subject ?? 'No subject',
    url: `/inbox?conversation=${conversationId}`,
    conversationId,
  }, 'assignments')
}

export async function notifyLiveChat(
  userIds: string[],
  contactName: string | null,
  conversationId: string
): Promise<void> {
  await sendPushToUsers(userIds, {
    title: 'New live chat',
    body: contactName ? `${contactName} has started a chat` : 'A visitor has started a chat',
    url: `/inbox?conversation=${conversationId}`,
    conversationId,
  }, 'live_chat')
}

export async function notifyNewMessage(
  userIds: string[],
  senderName: string,
  subject: string | null,
  conversationId: string
): Promise<void> {
  await sendPushToUsers(userIds, {
    title: `New message from ${senderName}`,
    body: subject ?? 'No subject',
    url: `/inbox?conversation=${conversationId}`,
    conversationId,
  }, 'messages')
}

export async function notifyCollaboratorAdded(
  userId: string,
  subject: string | null,
  conversationId: string
): Promise<void> {
  await sendPushToUsers([userId], {
    title: 'Added as collaborator',
    body: subject ?? 'No subject',
    url: `/inbox?conversation=${conversationId}`,
    conversationId,
  }, 'collaborators')
}

export async function notifyMention(
  userId: string,
  authorName: string,
  subject: string | null,
  conversationId: string
): Promise<void> {
  await sendPushToUsers([userId], {
    title: `${authorName} mentioned you`,
    body: subject ?? 'Internal note',
    url: `/inbox?conversation=${conversationId}`,
    conversationId,
  }, 'mentions')
}

export async function notifyInternalNote(
  userIds: string[],
  authorName: string,
  subject: string | null,
  conversationId: string
): Promise<void> {
  await sendPushToUsers(userIds, {
    title: `${authorName} added an internal note`,
    body: subject ?? 'No subject',
    url: `/inbox?conversation=${conversationId}`,
    conversationId,
  }, 'notes')
}

export async function notifyStaffReply(
  userIds: string[],
  authorName: string,
  subject: string | null,
  conversationId: string
): Promise<void> {
  await sendPushToUsers(userIds, {
    title: `${authorName} replied`,
    body: subject ?? 'No subject',
    url: `/inbox?conversation=${conversationId}`,
    conversationId,
  }, 'messages')
}
