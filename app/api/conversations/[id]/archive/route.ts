import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedClient } from '@/lib/gmail/client'
import { google } from 'googleapis'

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

  if (conversation.channel !== 'gmail' || !conversation.channel_config_id || !conversation.external_thread_id) {
    return NextResponse.json({ error: 'Not a Gmail conversation' }, { status: 400 })
  }

  try {
    const auth = await getAuthenticatedClient(conversation.channel_config_id)
    const gmail = google.gmail({ version: 'v1', auth })

    // Remove INBOX label from all messages in the thread (archives it in Gmail)
    await gmail.users.threads.modify({
      userId: 'me',
      id: conversation.external_thread_id,
      requestBody: { removeLabelIds: ['INBOX'] },
    })
  } catch (err) {
    console.error('[archive] Gmail archive failed:', err)
    return NextResponse.json({ error: 'Failed to archive in Gmail' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
