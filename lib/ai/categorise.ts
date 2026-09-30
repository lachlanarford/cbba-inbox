import { createServiceClient } from '@/lib/supabase/service'
import { decideTriageWrite, buildTriageScores, type TriageWrite } from '@/lib/ai/triage-decision'
import { triageQuestions } from '@/lib/ai/triage'
import { getTypeSafeClient } from '@/lib/ai/typesafe'
import type { Json } from '@/types/supabase'

export async function categoriseConversation(
  conversationId: string,
  content: string,
  subject?: string | null,
): Promise<void> {
  const client = getTypeSafeClient()
  if (!client) {
    console.error('[categorise] TYPESAFE_API_KEY is not set')
    return
  }

  const supabase = createServiceClient()
  const { data: conversation, error: readError } = await supabase
    .from('conversations')
    .select('department_source, priority_source')
    .eq('id', conversationId)
    .maybeSingle()

  if (readError || !conversation) {
    console.error('[categorise] could not read conversation', readError?.message)
    return
  }

  const response = await client.systemOne({
    state: {
      enquiry: {
        subject: subject ?? '',
        content,
      },
    },
    questions: triageQuestions,
  })

  const { department, priority, safety, complaint, payment, soon, refund, missingDetails, frustration } = response.answers
  const write: TriageWrite = decideTriageWrite(
    {
      departmentSource: conversation.department_source,
      prioritySource: conversation.priority_source,
    },
    {
      department: department.choice,
      departmentConfidence: department.confidence,
      priority: priority.choice,
      priorityConfidence: priority.confidence,
      safety: safety.noul,
      complaint: complaint.noul,
      payment: payment.noul,
      soon: soon.noul,
    },
  )

  const triageScores = buildTriageScores({
    safety: safety.noul,
    complaint: complaint.noul,
    payment: payment.noul,
    soon: soon.noul,
    refund: refund.noul,
    missingDetails: missingDetails.noul,
    frustration: frustration.score,
    frustrationConfidence: frustration.confidence,
  })

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ ...write, triage_scores: triageScores as unknown as Json })
    .eq('id', conversationId)
  if (updateError) console.error('[categorise] update failed', updateError.message)

  const { error: logError } = await supabase.from('ai_logs').insert({
    conversation_id: conversationId,
    action: 'categorise',
    input: `subject: ${subject ?? ''}\ncontent: ${content}`,
    output: JSON.stringify(response.answers),
    model: response.model,
    confidence: Math.min(department.confidence, priority.confidence),
  })
  if (logError) console.error('[categorise] log failed', logError.message)
}

/** Runs in the webhook or sync that already authenticated the inbound message. */
export async function triggerCategorise(
  conversationId: string,
  content: string,
  subject?: string | null,
): Promise<void> {
  try {
    await categoriseConversation(conversationId, content, subject)
  } catch (err) {
    console.error('[categorise]', err)
  }
}
