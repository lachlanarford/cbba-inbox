import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedClient } from '@/lib/gmail/client'
import { google } from 'googleapis'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let updates: Record<string, unknown>
  try {
    updates = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ALLOWED_FIELDS = new Set(['status', 'department', 'priority', 'assigned_to', 'needs_review', 'subject', 'snoozed_until'])
  const sanitised = Object.fromEntries(
    Object.entries(updates).filter(([key]) => ALLOWED_FIELDS.has(key))
  )
  if (Object.keys(sanitised).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('conversations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(sanitised as any)
    .eq('id', conversationId)
    .select('*, contact:contacts(*), assigned_user:users(id, full_name, avatar_url), channel_config:channel_configs(id, identifier)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: conversation } = await service
    .from('conversations')
    .select('channel, channel_config_id, external_thread_id')
    .eq('id', conversationId)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Trash in Gmail if applicable
  if (conversation.channel === 'gmail' && conversation.channel_config_id && conversation.external_thread_id) {
    try {
      const auth = await getAuthenticatedClient(conversation.channel_config_id)
      const gmail = google.gmail({ version: 'v1', auth })
      await gmail.users.threads.trash({
        userId: 'me',
        id: conversation.external_thread_id,
      })
    } catch (err) {
      console.error('[delete] Gmail trash failed:', err)
    }
  }

  await service.from('conversations').delete().eq('id', conversationId)

  return NextResponse.json({ ok: true })
}
