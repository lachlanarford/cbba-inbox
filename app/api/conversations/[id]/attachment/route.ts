import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedClient } from '@/lib/gmail/client'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params
  const { searchParams } = new URL(request.url)
  const msgId = searchParams.get('msgId')
  const attId = searchParams.get('attId')
  const name = searchParams.get('name') ?? 'attachment'

  if (!msgId || !attId) return NextResponse.json({ error: 'msgId and attId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: conversation } = await service
    .from('conversations')
    .select('channel_config_id')
    .eq('id', conversationId)
    .single()

  if (!conversation?.channel_config_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const auth = await getAuthenticatedClient(conversation.channel_config_id)
  const gmail = google.gmail({ version: 'v1', auth })

  const att = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: msgId,
    id: attId,
  })

  const raw = att.data.data
  if (!raw) return NextResponse.json({ error: 'Attachment data not found' }, { status: 404 })

  const buffer = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const safeName = name.replace(/[^a-zA-Z0-9._\-() ]/g, '_')

  return new Response(buffer, {
    headers: {
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(buffer.length),
    },
  })
}
