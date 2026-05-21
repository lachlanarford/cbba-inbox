import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import aiClient, { AI_MODEL, AI_MAX_TOKENS } from '@/lib/ai/client'
import { searchKnowledge } from '@/lib/knowledge/search'
import { processIncomingMessage } from '@/lib/channels/processor'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

interface ChatRequest {
  message: string
  session_id: string
  contact_info?: {
    name?: string
    email?: string
    department?: string
  }
}

export async function POST(request: Request) {
  let body: ChatRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  const { message, session_id, contact_info } = body
  if (!message?.trim() || !session_id) {
    return NextResponse.json({ error: 'Missing message or session_id' }, { status: 400, headers: CORS_HEADERS })
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
    let conversationId: string | null = null

    // Find an existing live chat conversation for this session — but only if it's
    // still open and was actually created as a live chat (not an AI session reuse).
    const { data: existingMsg } = await supabase
      .from('chat_messages')
      .select('conversation_id')
      .eq('session_id', session_id)
      .not('conversation_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingMsg?.conversation_id) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, status, subject')
        .eq('id', existingMsg.conversation_id)
        .maybeSingle()
      // Only reuse if it's an open live chat conversation (not an AI session or closed)
      if (conv && conv.status !== 'closed' && conv.subject?.startsWith('Live Chat')) {
        conversationId = conv.id
      }
    }

    if (!conversationId) {
      // Create a new live chat conversation
      let createError: unknown = null
      try {
        const result = await processIncomingMessage({
          channel: 'chat',
          channelConfigId: null,
          contactFullName: contact_info?.name ?? null,
          contactEmail: contact_info?.email ?? null,
          contactPhone: null,
          contactSocialId: session_id,
          subject: contact_info?.name ? `Live Chat - ${contact_info.name}` : 'Live Chat',
          content: message,
        })
        conversationId = result.conversationId
      } catch (err) {
        createError = err
        console.error('[api/chat] processIncomingMessage failed:', err)
      }

      if (conversationId) {
        // Set department if provided
        if (contact_info?.department) {
          await supabase
            .from('conversations')
            .update({ department: contact_info.department })
            .eq('id', conversationId)
        }

        // Notify staff (isolated — failure here does not affect the conversation)
        try {
          const { data: staffUsers } = await supabase
            .from('users')
            .select('id')
            .eq('is_active', true)
          if (staffUsers?.length) {
            await supabase.from('notifications').insert(
              staffUsers.map((u) => ({
                user_id: u.id,
                type: 'live_chat' as const,
                title: 'New live chat',
                body: contact_info?.name ? `${contact_info.name} has started a chat` : 'A visitor has started a chat',
                conversation_id: conversationId,
              }))
            )
          }
        } catch (notifErr) {
          console.error('[api/chat] notification insert failed:', notifErr)
        }
      } else if (!createError) {
        console.error('[api/chat] processIncomingMessage returned no conversationId')
      }
    } else {
      // Append to the existing live conversation
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
      reply: 'You are now connected to our team. We will reply shortly.',
    }, { headers: CORS_HEADERS })
  }

  // AI mode — find or create conversation so it appears in the inbox
  let aiConversationId: string | null = null

  const { data: existingAiMsg } = await supabase
    .from('chat_messages')
    .select('conversation_id')
    .eq('session_id', session_id)
    .not('conversation_id', 'is', null)
    .limit(1)
    .maybeSingle()

  aiConversationId = existingAiMsg?.conversation_id ?? null

  if (!aiConversationId) {
    try {
      const result = await processIncomingMessage({
        channel: 'chat',
        channelConfigId: null,
        contactFullName: contact_info?.name ?? null,
        contactEmail: contact_info?.email ?? null,
        contactPhone: null,
        contactSocialId: session_id,
        subject: contact_info?.name ? `AI Chat - ${contact_info.name}` : 'AI Chat',
        content: message,
      })
      aiConversationId = result.conversationId
      if (contact_info?.department && aiConversationId) {
        await supabase.from('conversations').update({ department: contact_info.department }).eq('id', aiConversationId)
      }
    } catch (err) {
      console.error('[api/chat] AI mode failed to create conversation:', err)
    }
  } else {
    await supabase.from('messages').insert({
      conversation_id: aiConversationId,
      sender_type: 'contact',
      sender_id: null,
      content: message,
      is_internal_note: false,
    })
  }

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
    conversation_id: aiConversationId,
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
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500, headers: CORS_HEADERS })
  }

  // Save AI response to chat_messages and to the conversation thread
  await Promise.all([
    supabase.from('chat_messages').insert({
      session_id,
      role: 'assistant',
      content: aiResponse,
      conversation_id: aiConversationId,
    }),
    aiConversationId
      ? supabase.from('messages').insert({
          conversation_id: aiConversationId,
          sender_type: 'ai',
          sender_id: null,
          content: aiResponse,
          is_internal_note: false,
        })
      : Promise.resolve(),
  ])

  return NextResponse.json({ mode: 'ai', reply: aiResponse }, { headers: CORS_HEADERS })
}
