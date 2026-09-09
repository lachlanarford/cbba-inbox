import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConversationPrintView, { type PrintMessage } from '@/components/inbox/ConversationPrintView'
import PrintTrigger from '@/components/inbox/PrintTrigger'
import { formatPrintDate } from '@/lib/email/print-conversation'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('conversations')
    .select('subject')
    .eq('id', params.id)
    .maybeSingle()
  const subject = data?.subject?.trim() || 'Conversation'
  return { title: `Print: ${subject}` }
}

export default async function PrintConversationPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { message?: string }
}) {
  const supabase = await createClient()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, subject, channel, contact:contacts(full_name, email), channel_config:channel_configs(identifier)')
    .eq('id', params.id)
    .maybeSingle()

  if (!conversation) notFound()

  const { data: messageRows } = await supabase
    .from('messages')
    .select('id, content, created_at, sender_type, is_internal_note, from_address, from_name, cc_addresses, sender:users(full_name, email)')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  const allMessages = (messageRows ?? []) as unknown as PrintMessage[]
  const messageId = searchParams.message?.trim()
  const selected = messageId ? allMessages.find((m) => m.id === messageId) : null
  const messages = selected
    ? [selected]
    : allMessages.filter((m) => !m.is_internal_note)

  const contact = conversation.contact as unknown as { full_name: string | null; email: string | null } | null
  const channelConfig = conversation.channel_config as unknown as { identifier: string } | null

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <style>{`
        @page { margin: 16mm; }
        @media print {
          html, body { background: #fff !important; color: #111827 !important; }
          .print-email-body img { max-width: 100% !important; height: auto !important; }
          .print-email-body a { color: #604484; }
        }
        .print-email-body img { max-width: 100%; height: auto; }
        .print-email-body a { color: #604484; }
      `}</style>
      <PrintTrigger />
      <ConversationPrintView
        subject={conversation.subject?.trim() || 'No subject'}
        channel={conversation.channel}
        contactName={contact?.full_name ?? null}
        contactEmail={contact?.email ?? null}
        inboxFromAddress={channelConfig?.identifier ?? null}
        printedAt={formatPrintDate(new Date().toISOString())}
        chain={!selected}
        messages={messages}
      />
    </div>
  )
}
