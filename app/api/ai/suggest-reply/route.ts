import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { choice, noul } from '@typesafe-ai/sdk'
import aiClient, { AI_MODEL, AI_MAX_TOKENS } from '@/lib/ai/client'
import { draftNeedsFactCheck, pickCannedResponse } from '@/lib/ai/reply-decision'
import { getTypeSafeClient } from '@/lib/ai/typesafe'
import { searchKnowledge } from '@/lib/knowledge/search'

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

  const latestCustomer = [...messages].reverse().find((m) => m.sender_type === 'contact')?.content ?? thread
  const typesafe = getTypeSafeClient()

  const { data: templates } = await service
    .from('canned_responses')
    .select('id, title, content')
    .order('title', { ascending: true })
    .limit(30)

  if (typesafe && templates?.length) {
    const criteria: Record<string, string> = {
      none: 'No saved template is a good reply to this message.',
    }
    for (const template of templates) criteria[template.id] = template.title

    try {
      const picked = await typesafe.systemOne({
        state: {
          customer: { message: latestCustomer, subject: conversation.subject ?? '' },
        },
        questions: {
          template: choice(
            'Which saved template, if any, should be sent as the reply to `customer.message`? Choose none when no template fits.',
            criteria,
          ),
        },
      })
      const templateId = pickCannedResponse({
        choice: picked.answers.template.choice,
        confidence: picked.answers.template.confidence,
        ids: templates.map((template) => template.id),
      })
      const template = templates.find((item) => item.id === templateId)
      if (template) {
        await service.from('ai_logs').insert({
          conversation_id,
          action: 'suggest_reply',
          input: latestCustomer,
          output: template.content,
          model: picked.model,
          confidence: picked.answers.template.confidence,
        })
        return NextResponse.json({ suggestion: template.content, source: 'template', needsReview: false })
      }
    } catch (err) {
      console.error('[ai/suggest-reply] template pick failed', err)
    }
  }

  const { context: knowledgeContext } = await searchKnowledge(latestCustomer, {
    department: conversation.department,
  })

  const prompt = `Draft a reply to the following conversation. The reply will be reviewed and edited by a staff member before sending. Use only facts that appear in the knowledge excerpts. If the excerpts do not contain a fact, say the team will confirm it. Provide one suggested reply only, no preamble, no explanation, just the reply text.

Department: ${conversation.department ?? 'Unknown'}
Channel: ${conversation.channel}

Knowledge excerpts:
${knowledgeContext || '(none)'}

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

  let needsReview = !typesafe
  if (typesafe && suggestion) {
    try {
      const checked = await typesafe.systemOne({
        state: {
          draft: suggestion,
          knowledge: { excerpts: knowledgeContext },
        },
        questions: {
          unsupported: noul(
            'Does `draft` state a fee, date, time, venue, age group, phone number, or link that is not written in `knowledge.excerpts`?',
            {
              true: 'The draft adds a concrete fact the excerpts do not contain.',
              false: 'Every concrete fact in the draft is in the excerpts, or the draft states no such fact.',
            },
          ),
        },
      })
      needsReview = draftNeedsFactCheck(checked.answers.unsupported.noul)
    } catch (err) {
      console.error('[ai/suggest-reply] fact check failed', err)
      needsReview = true
    }
  }

  await service.from('ai_logs').insert({
    conversation_id,
    action: 'suggest_reply',
    input: thread,
    output: JSON.stringify({ suggestion, needsReview }),
    model: AI_MODEL,
    confidence: null,
  })

  return NextResponse.json({ suggestion, source: 'draft', needsReview })
}
