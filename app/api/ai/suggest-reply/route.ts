import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import aiClient, { AI_MODEL, AI_MAX_TOKENS } from '@/lib/ai/client'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { conversation_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { conversation_id } = body
  if (!conversation_id) return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 })

  const service = createServiceClient()

  const { data: conversation } = await service
    .from('conversations')
    .select('id, channel, department, subject')
    .eq('id', conversation_id)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const { data: messages } = await service
    .from('messages')
    .select('sender_type, content, created_at')
    .eq('conversation_id', conversation_id)
    .eq('is_internal_note', false)
    .order('created_at', { ascending: true })
    .limit(10)

  if (!messages?.length) return NextResponse.json({ error: 'No messages found' }, { status: 404 })

  const thread = messages
    .map((m) => `${m.sender_type === 'contact' ? 'Customer' : 'Staff'}: ${m.content}`)
    .join('\n\n')

  const prompt = `Draft a reply to the following conversation. The reply will be reviewed and edited by a staff member before sending. Provide one suggested reply only, no preamble, no explanation, just the reply text.

Department: ${conversation.department ?? 'Unknown'}
Channel: ${conversation.channel}

Conversation:
${thread}`

  let suggestion: string
  try {
    const response = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: 'You are a helpful assistant drafting replies on behalf of CBBA (City of Blacktown Basketball Association), a community basketball organisation in Western Sydney. Write in a warm, professional, community-focused tone. Be concise and helpful. Never use em dashes.',
      messages: [{ role: 'user', content: prompt }],
    })
    suggestion = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  } catch (err) {
    console.error('[ai/suggest-reply] error:', err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }

  await service.from('ai_logs').insert({
    conversation_id,
    action: 'suggest_reply',
    input: thread,
    output: suggestion,
    model: AI_MODEL,
    confidence: null,
  })

  return NextResponse.json({ suggestion })
}
