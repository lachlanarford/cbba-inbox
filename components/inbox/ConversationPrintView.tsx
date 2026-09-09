import { formatPrintDate, printMessageBodyHtml, channelLabel } from '@/lib/email/print-conversation'

export interface PrintMessage {
  id: string
  content: string
  created_at: string
  sender_type: string
  is_internal_note: boolean
  from_address: string | null
  from_name: string | null
  cc_addresses: string[] | null
  sender: { full_name: string | null; email: string | null } | null
}

interface ConversationPrintViewProps {
  subject: string
  channel: string
  contactName: string | null
  contactEmail: string | null
  inboxFromAddress: string | null
  printedAt: string
  chain: boolean
  messages: PrintMessage[]
}

function senderLabel(message: PrintMessage, contactName: string | null, contactEmail: string | null, inboxFromAddress: string | null): { name: string; address: string | null } {
  if (message.sender_type === 'contact') {
    const name = message.from_name?.trim() || contactName || message.from_address || contactEmail || 'Contact'
    const address = message.from_address?.trim() || contactEmail || null
    return { name, address: address && address !== name ? address : null }
  }
  if (message.sender_type === 'ai') {
    return { name: 'AI Assistant', address: null }
  }
  const name = message.sender?.full_name?.trim() || message.from_name?.trim() || 'Staff'
  const address = message.from_address?.trim() || inboxFromAddress || message.sender?.email || null
  return { name, address }
}

export default function ConversationPrintView({
  subject,
  channel,
  contactName,
  contactEmail,
  inboxFromAddress,
  printedAt,
  chain,
  messages,
}: ConversationPrintViewProps) {
  return (
    <article className="print-conversation">
      <header className="border-b-2 border-[#604484] pb-4 mb-6">
        <p className="text-xs font-semibold tracking-wide uppercase text-[#604484]">
          CBBA Storm Basketball
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[#111827]">{subject}</h1>
        <dl className="mt-3 grid gap-1 text-sm text-[#4b5563]">
          <div>
            <span className="font-medium text-[#111827]">From contact: </span>
            {contactName || contactEmail || 'Unknown'}
            {contactName && contactEmail ? ` (${contactEmail})` : ''}
          </div>
          {inboxFromAddress && (
            <div>
              <span className="font-medium text-[#111827]">Inbox: </span>
              {inboxFromAddress}
            </div>
          )}
          <div>
            <span className="font-medium text-[#111827]">Channel: </span>
            {channelLabel(channel)}
          </div>
          <div>
            <span className="font-medium text-[#111827]">
              {chain ? 'Printed chain: ' : 'Printed email: '}
            </span>
            {printedAt}
          </div>
        </dl>
      </header>

      {messages.length === 0 ? (
        <p className="text-sm text-[#6b7280]">No messages to print.</p>
      ) : (
      <div className="space-y-5">
        {messages.map((message) => {
          const sender = senderLabel(message, contactName, contactEmail, inboxFromAddress)
          const body = printMessageBodyHtml(message.content)
          const cc = message.cc_addresses?.filter(Boolean) ?? []
          return (
            <section
              key={message.id}
              className="break-inside-avoid rounded-lg border border-[#e5e7eb] p-4"
            >
              <div className="mb-3 border-b border-[#f3f4f6] pb-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-[#111827]">
                    {sender.name}
                    {message.is_internal_note && (
                      <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-[#b45309]">
                        Internal note
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#6b7280]">{formatPrintDate(message.created_at)}</p>
                </div>
                {sender.address && (
                  <p className="text-xs text-[#6b7280]">{sender.address}</p>
                )}
                {cc.length > 0 && (
                  <p className="text-xs text-[#6b7280]">CC: {cc.join(', ')}</p>
                )}
              </div>
              {body.html ? (
                <div
                  className="print-email-body text-sm text-[#111827] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: body.html }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-[#111827] leading-relaxed">
                  {body.text || '(No content)'}
                </p>
              )}
              {body.attachments.length > 0 && (
                <p className="mt-3 border-t border-[#f3f4f6] pt-2 text-xs text-[#6b7280]">
                  Attachments: {body.attachments.join(', ')}
                </p>
              )}
            </section>
          )
        })}
      </div>
      )}
    </article>
  )
}
