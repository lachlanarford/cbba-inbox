import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Resend } from 'resend'
import { feedbackRequestEmail } from '@/lib/emails/feedbackRequest'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id: conversationId } = params
  const supabase = createServiceClient()

  // Update conversation status to closed
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select('*, contact:contacts(full_name, email)')
    .single()

  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const contact = conv.contact as unknown as { full_name: string | null; email: string | null } | null
  const contactEmail = contact?.email ?? null

  // Create feedback request (ignore if one already exists for this conversation)
  const { data: feedbackRow } = await supabase
    .from('feedback_requests')
    .insert({
      conversation_id: conversationId,
      contact_email: contactEmail,
      contact_name: contact?.full_name ?? null,
    })
    .select('token')
    .single()

  let feedbackSent = false

  if (feedbackRow && contactEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const feedbackBaseUrl = `${appUrl}/api/feedback/${feedbackRow.token}`
    const { subject, html } = feedbackRequestEmail({
      contactName: contact?.full_name ?? null,
      subject: conv.subject ?? null,
      feedbackBaseUrl,
    })

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const fromAddress = process.env.RESEND_FROM_ADDRESS ?? 'noreply@blacktownbasketball.com'
      await resend.emails.send({
        from: `CBBA Support <${fromAddress}>`,
        to: [contactEmail],
        subject,
        html,
      })
      feedbackSent = true
    } catch (err) {
      console.error('[close] resend error:', err)
    }
  }

  return NextResponse.json({ ok: true, feedbackSent })
}
