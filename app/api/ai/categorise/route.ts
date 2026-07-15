import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import aiClient, { AI_MODEL, AI_MAX_TOKENS } from '@/lib/ai/client'

interface CategoriseRequest {
  conversation_id: string
  content: string
  subject?: string
}

interface CategoriseResult {
  department: string
  priority: string
  confidence: number
  reasoning: string
}

export async function POST(request: Request) {
  let body: CategoriseRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { conversation_id, content, subject } = body
  if (!conversation_id || !content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const prompt = `Classify this enquiry into exactly one department and one priority. Respond in JSON only, no other text.

Departments:
- Reps: representative basketball, MJL, grading, trials, rep team enquiries
- Comps: domestic competitions, draws, results, registrations, courts
- LTP: Learn to Play, Aussie Hoops, junior development, beginner programs
- Referees: referee enquiries, referee registration, referee payments, referee availability, referee appointments, officiating
- Other: anything that does not fit the above

Priorities:
- urgent: time-sensitive, complaint, legal, safety, event happening within 48 hours
- high: requires response within 24 hours, registration deadline, payment issue
- medium: general enquiry, standard turnaround
- low: feedback, non-urgent information request

Enquiry subject: ${subject ?? '(none)'}
Enquiry content: ${content}

Respond with exactly this JSON structure:
{
  "department": "Reps | Comps | LTP | Referees | Other",
  "priority": "urgent | high | medium | low",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explanation"
}`

  let result: CategoriseResult
  try {
    const response = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: 'You are a classification assistant for CBBA (City of Blacktown Basketball Association), a community basketball organisation in Western Sydney. Classify inbound enquiries accurately and concisely.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    result = JSON.parse(jsonMatch[0]) as CategoriseResult
  } catch (err) {
    console.error('[ai/categorise] error:', err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }

  const { department, priority, confidence, reasoning } = result
  const needsReview = confidence < 0.6

  await supabase
    .from('conversations')
    .update({ department, priority, needs_review: needsReview })
    .eq('id', conversation_id)

  await supabase.from('ai_logs').insert({
    conversation_id,
    action: 'categorise',
    input: `subject: ${subject ?? ''}\ncontent: ${content}`,
    output: reasoning,
    model: AI_MODEL,
    confidence,
  })

  return NextResponse.json({ department, priority, confidence, needs_review: needsReview })
}
