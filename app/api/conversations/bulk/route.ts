import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedClient } from '@/lib/gmail/client'
import { google } from 'googleapis'

type BulkAction = 'archive' | 'delete' | 'status' | 'priority' | 'assign'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { ids: string[]; action: BulkAction; value?: string }
  const { ids, action, value } = body
  if (!ids?.length || !action) return NextResponse.json({ error: 'ids and action required' }, { status: 400 })

  const service = createServiceClient()

  if (action === 'status') {
    if (!value) return NextResponse.json({ error: 'value required' }, { status: 400 })
    await service.from('conversations').update({ status: value }).in('id', ids)
    return NextResponse.json({ ok: true })
  }

  if (action === 'priority') {
    if (!value) return NextResponse.json({ error: 'value required' }, { status: 400 })
    await service.from('conversations').update({ priority: value }).in('id', ids)
    return NextResponse.json({ ok: true })
  }

  if (action === 'assign') {
    await service.from('conversations').update({ assigned_to: value ?? null }).in('id', ids)
    return NextResponse.json({ ok: true })
  }

  // For archive/delete we need conversation details for Gmail operations
  const { data: conversations } = await service
    .from('conversations')
    .select('id, channel, channel_config_id, external_thread_id')
    .in('id', ids)

  if (!conversations?.length) return NextResponse.json({ ok: true })

  if (action === 'archive') {
    for (const conv of conversations) {
      if (conv.channel === 'gmail' && conv.channel_config_id && conv.external_thread_id) {
        try {
          const auth = await getAuthenticatedClient(conv.channel_config_id)
          const gmail = google.gmail({ version: 'v1', auth })
          await gmail.users.threads.modify({
            userId: 'me',
            id: conv.external_thread_id,
            requestBody: { removeLabelIds: ['INBOX'] },
          })
        } catch (err) {
          console.error('[bulk archive] Gmail failed for', conv.id, err)
        }
      }
    }
    await service.from('conversations').update({ status: 'closed' }).in('id', ids)
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    for (const conv of conversations) {
      if (conv.channel === 'gmail' && conv.channel_config_id && conv.external_thread_id) {
        try {
          const auth = await getAuthenticatedClient(conv.channel_config_id)
          const gmail = google.gmail({ version: 'v1', auth })
          await gmail.users.threads.trash({
            userId: 'me',
            id: conv.external_thread_id,
          })
        } catch (err) {
          console.error('[bulk delete] Gmail trash failed for', conv.id, err)
        }
      }
    }
    await service.from('conversations').delete().in('id', ids)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
