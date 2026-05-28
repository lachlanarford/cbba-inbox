import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { markThreadAsUnread } from '@/lib/gmail/client'

export async function POST(
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

  await service
    .from('conversations')
    .update({ is_read: false })
    .eq('id', conversationId)

  if (conversation.channel === 'gmail' && conversation.channel_config_id && conversation.external_thread_id) {
    try {
      await markThreadAsUnread(conversation.channel_config_id, conversation.external_thread_id)
    } catch (err) {
      console.error('[mark-unread] Gmail failed:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
