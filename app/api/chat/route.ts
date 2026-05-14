import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import aiClient, { AI_MODEL, AI_MAX_TOKENS } from '@/lib/ai/client'
import { searchKnowledge } from '@/lib/knowledge/search'
import { processIncomingMessage } from '@/lib/channels/processor'

interface ChatRequest {
  message: string
  session_id: string
  contact_info?: {
    name?: string
    email?: string
  }
}

export async function POST(request: Request) {
  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, session_id, contact_info } = body
  if (!message?.trim() || !session_id) {
    return NextResponse.json({ error: 'Missing message or session_id' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Get chat_mode setting
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'chat_mode')
    .single()

  const chatMode = setting?.value ?? 'ai'

  if (chatMode === 'live') {
    // Find or create conversation for this session
    let conversationId: string | null = null

    const { data: existingMsg } = await supabase
      .from('chat_messages')
      .select('conversation_id')
      .eq('session_id', session_id)
      .not('conversation_id', 'is', null)
      .limit(1)
      .single()

    conversationId = existingMsg?.conversation_id ?? null

    if (!conversationId) {
      try {
        const result = await processIncomingMessage({
          channel: 'chat',
          channelConfigId: null,
          contactFullName: contact_info?.name ?? null,
          contactEmail: contact_info?.email ?? null,
          contactPhone: null,
          contactSocialId: session_id,
          subject: 'Live Chat',
          content: message,
        })
        conversationId = result.conversationId
      } catch (err) {
        console.error('[api/chat] failed to create conversation:', err)
      }
    } else {
      // Add message to existing conversation
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: 'contact',
        sender_id: null,
        content: message,
        is_internal_note: false,
      })
    }

    await supabase.from('chat_messages').insert({
      session_id,
      role: 'user',
      content: message,
      conversation_id: conversationId,
    })

    return NextResponse.json({
      mode: 'live',
      message: 'You are now connected to our team. We will reply shortly.',
    })
  }

  // AI mode
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true })
    .limit(6)

  // Save inbound message
  await supabase.from('chat_messages').insert({
    session_id,
    role: 'user',
    content: message,
    conversation_id: null,
  })

  const knowledgeContext = await searchKnowledge(message)

  const systemPrompt = `You are a helpful assistant for CBBA (City of Blacktown Basketball Association), a community basketball organisation in Western Sydney, Australia. Answer questions about our programs, competitions, and services. Be warm, concise, and helpful. If you cannot answer confidently from the provided context, say so and suggest the person contact us directly at info@blacktownbasketball.com. Never make up information. Never use em dashes.${knowledgeContext ? `\n\nKnowledge base context:\n${knowledgeContext}` : ''}`

  const conversationHistory = (history ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  conversationHistory.push({ role: 'user', content: message })

  let aiResponse: string
  try {
    const response = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: systemPrompt,
      messages: conversationHistory,
    })
    aiResponse = response.content[0].type === 'text' ? response.content[0].text.trim() : 'Sorry, I could not generate a response.'
  } catch (err) {
    console.error('[api/chat] AI error:', err)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
  }

  // Save AI response
  await supabase.from('chat_messages').insert({
    session_id,
    role: 'assistant',
    content: aiResponse,
    conversation_id: null,
  })

  return NextResponse.json({ mode: 'ai', message: aiResponse })
}
