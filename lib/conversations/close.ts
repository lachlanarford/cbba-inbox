import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type ServiceClient = SupabaseClient<Database>

/** Close one conversation and create a feedback request (idempotent). */
export async function closeConversation(
  supabase: ServiceClient,
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select('*, contact:contacts(full_name, email)')
    .single()

  if (convError || !conv) {
    return { ok: false, error: 'Conversation not found' }
  }

  const contact = conv.contact as unknown as { full_name: string | null; email: string | null } | null

  const { data: existingFeedback } = await supabase
    .from('feedback_requests')
    .select('id')
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (!existingFeedback) {
    await supabase
      .from('feedback_requests')
      .insert({
        conversation_id: conversationId,
        contact_email: contact?.email ?? null,
        contact_name: contact?.full_name ?? null,
      })
  }

  return { ok: true }
}
