import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processIncomingMessage } from '@/lib/channels/processor'
import { triggerCategorise } from '@/lib/ai/categorise'

export async function POST(request: Request) {
  const secret = request.headers.get('x-form-secret')
  if (!secret || secret !== process.env.FORM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, string>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { full_name, email, subject, message, phone, department } = body
  if (!full_name || !email || !subject || !message) {
    return NextResponse.json(
      { error: 'Missing required fields: full_name, email, subject, message' },
      { status: 400 }
    )
  }

  // Check form channel active state
  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('channel_configs')
    .select('id, is_active')
    .eq('channel_type', 'form')
    .maybeSingle()

  if (config && !config.is_active) {
    return NextResponse.json({ success: true, message: 'Form submissions currently disabled' })
  }

  try {
    const result = await processIncomingMessage({
      channel: 'form',
      channelConfigId: config?.id ?? null,
      contactFullName: full_name,
      contactEmail: email,
      contactPhone: phone ?? null,
      contactSocialId: null,
      subject,
      content: message,
      department: department ?? null,
    })

    triggerCategorise(result.conversationId, message, subject)
    return NextResponse.json({ success: true, conversation_id: result.conversationId })
  } catch (err) {
    console.error('[webhook/form]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
