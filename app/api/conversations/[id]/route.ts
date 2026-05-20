import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedClient } from '@/lib/gmail/client'
import { google } from 'googleapis'

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
