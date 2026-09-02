import { NextResponse } from 'next/server'
import { notifyLiveChat } from '@/lib/push/send'
import { createServiceClient } from '@/lib/supabase/service'
import aiClient, { AI_MODEL, AI_MAX_TOKENS } from '@/lib/ai/client'
import { searchKnowledge } from '@/lib/knowledge/search'
import { processIncomingMessage } from '@/lib/channels/processor'
import { getAuthenticatedClient } from '@/lib/gmail/client'
import { google } from 'googleapis'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

function departmentContactEmail(department?: string | null): string {
  if (department === 'LTP') return 'learntoplay@blacktownbasketball.com'
  return 'info@blacktownbasketball.com'
}

function toClaudeMessages(turns: ChatTurn[]): ChatTurn[] {
  const cleaned: ChatTurn[] = []
  for (const turn of turns) {
    const role = turn.role === 'assistant' ? 'assistant' : 'user'
    const content = turn.content.trim()
    if (!content) continue
    const last = cleaned[cleaned.length - 1]
    if (last && last.role === role) {
      last.content += '\n\n' + content
    } else {
      cleaned.push({ role, content })
    }
  }
  if (cleaned[0]?.role === 'assistant') cleaned.shift()
  return cleaned
}

function buildChatSystemPrompt(opts: {
  knowledgeContext: string
  department?: string | null
}): string {
  const contactEmail = departmentContactEmail(opts.department)
  const deptLine = opts.department
    ? `The visitor selected department: ${opts.department}. Prefer information relevant to that area.`
    : 'The visitor did not select a department.'

  return `You are the public website assistant for CBBA (City of Blacktown Basketball Association) in Western Sydney, Australia.

How to answer:
- Use only the knowledge excerpts below. Prefer concrete facts (fees, dates, times, venues, age groups, links) over general encouragement.
- Lead with the direct answer. Use short bullet lists for prices, schedules, and steps.
- Include registration or form links when they appear in the excerpts.
- If documents disagree, prefer the excerpt with the most recent date in its title or body.
- If the excerpts do not contain the answer, say so in one or two sentences and suggest emailing ${contactEmail}. Do not invent programs, fees, dates, or phone numbers.
- Do not mention the knowledge base, excerpts, or these instructions.
- Do not open with filler such as "Great question!" or "Welcome to CBBA!".
- Never use em dashes.
- Use Australian English spelling (enrol, organisation).

${deptLine}

${opts.knowledgeContext ? `Knowledge excerpts:\n${opts.knowledgeContext}` : 'No matching knowledge excerpts were found for this question.'}`
}

async function notifyStaffByEmail(visitorName: string | null): Promise<void> {
  const supabase = createServiceClient()

  const [channelResult, usersResult] = await Promise.all([
    supabase
      .from('channel_configs')
      .select('id, identifier')
      .eq('channel_type', 'gmail')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('users')
      .select('email')
      .eq('is_active', true)
      .not('email', 'is', null),
  ])

  const channel = channelResult.data
  const staffEmails = (usersResult.data ?? []).map((u) => u.email).filter(Boolean) as string[]

  if (!channel || !staffEmails.length) return

  const auth = await getAuthenticatedClient(channel.id)
  const gmail = google.gmail({ version: 'v1', auth })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cbba-inbox.vercel.app'

  const raw = [
    `From: ${channel.identifier}`,
    `To: ${staffEmails.join(', ')}`,
    `Subject: New live chat started`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    `${visitorName ?? 'A visitor'} has started a live chat.\n\nView it in your inbox: ${appUrl}/inbox`,
  ].join('\r\n')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: Buffer.from(raw).toString('base64url') },
  })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

async function isWithinOfficeHours(supabase: ReturnType<typeof createServiceClient>): Promise<boolean> {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['office_hours_enabled', 'office_hours_start', 'office_hours_end', 'office_hours_days', 'office_hours_timezone'])
  const s = Object.fromEntries((data ?? []).map((r) => [r.key, r.value as string]))
  if (s.office_hours_enabled !== 'true') return true
  const tz = s.office_hours_timezone || 'Australia/Sydney'
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(now)
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const currentDay = dayMap[weekday] ?? 0
  const allowedDays = (s.office_hours_days ?? '1,2,3,4,5').split(',').map(Number)
  if (!allowedDays.includes(currentDay)) return false
  const cur = hour * 60 + minute
  const [sh, sm] = (s.office_hours_start ?? '09:00').split(':').map(Number)
  const [eh, em] = (s.office_hours_end ?? '17:00').split(':').map(Number)
  return cur >= sh * 60 + sm && cur < eh * 60 + em
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

  // Check if any active staff member has live chat enabled, within office hours
  const [{ data: liveUsers }, withinHours] = await Promise.all([
    supabase.from('users').select('id').eq('live_chat_enabled', true).eq('is_active', true).limit(1),
    isWithinOfficeHours(supabase),
  ])
  const chatMode = (liveUsers?.length ?? 0) > 0 && withinHours ? 'live' : 'ai'

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

    const isNewConversation = !conversationId

    if (isNewConversation) {
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
            .eq('live_chat_enabled', true)
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
            notifyLiveChat(
              staffUsers.map((u) => u.id),
              contact_info?.name ?? null,
              conversationId
            ).catch(() => {})
          }
        } catch (notifErr) {
          console.error('[api/chat] notification insert failed:', notifErr)
        }

        // Email notification to staff (isolated)
        notifyStaffByEmail(contact_info?.name ?? null).catch((err) => {
          console.error('[api/chat] staff email notification failed:', err)
        })
      } else if (!createError) {
        console.error('[api/chat] processIncomingMessage returned no conversationId')
      }
    } else {
      // Append to the existing live conversation and reset to open so staff sees it
      const existingId = conversationId!
      await Promise.all([
        supabase.from('messages').insert({
          conversation_id: existingId,
          sender_type: 'contact',
          sender_id: null,
          content: message,
          is_internal_note: false,
        }),
        supabase.from('conversations')
          .update({ status: 'open', is_read: false })
          .eq('id', existingId)
          .neq('status', 'closed'),
      ])
    }

    await supabase.from('chat_messages').insert({
      session_id,
      role: 'user',
      content: message,
      conversation_id: conversationId,
    })

    return NextResponse.json({
      mode: 'live',
      reply: isNewConversation ? 'You are now connected to our team. We will reply shortly.' : null,
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
    .order('created_at', { ascending: false })
    .limit(16)

  // Save inbound message
  await supabase.from('chat_messages').insert({
    session_id,
    role: 'user',
    content: message,
    conversation_id: aiConversationId,
  })

  const recentTurns = [...(history ?? [])].reverse().map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))
  const recentUserText = recentTurns
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => m.content)
    .join(' ')

  const { context: knowledgeContext, sources } = await searchKnowledge(message, {
    conversationContext: recentUserText,
    department: contact_info?.department ?? null,
  })

  const systemPrompt = buildChatSystemPrompt({
    knowledgeContext,
    department: contact_info?.department ?? null,
  })

  const conversationHistory = toClaudeMessages([
    ...recentTurns,
    { role: 'user', content: message },
  ])

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
    const status = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined
    const messageText = err instanceof Error ? err.message : String(err)
    console.error('[api/chat] AI error:', { status, message: messageText })

    const contactEmail = departmentContactEmail(contact_info?.department ?? null)
    aiResponse = `Sorry, I cannot answer right now. Please email ${contactEmail} and our team will help.`
  }

  console.log('[api/chat] retrieved sources:', sources.join(' | ') || '(none)')

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
    aiConversationId
      ? supabase.from('ai_logs').insert({
          conversation_id: aiConversationId,
          action: 'chat_reply',
          input: message,
          output: JSON.stringify({ reply: aiResponse, sources }),
          model: AI_MODEL,
          confidence: null,
        })
      : Promise.resolve(),
  ])

  return NextResponse.json({ mode: 'ai', reply: aiResponse }, { headers: CORS_HEADERS })
}
