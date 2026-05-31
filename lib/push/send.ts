import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

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

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any
  const { data: rows } = await db.from('push_subscriptions').select('endpoint, subscription')
  if (!rows || rows.length === 0) return

  const json = JSON.stringify(payload)
  await Promise.allSettled(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rows as any[]).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription as webpush.PushSubscription, json)
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
        }
      }
    })
  )
}
