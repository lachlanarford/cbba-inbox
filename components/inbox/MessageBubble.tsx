'use client'

import { useState, type ReactNode } from 'react'
import type { MessageWithSender } from '@/types/database'
import { formatDateTime } from '@/lib/utils/time'
import { looksLikeHtml, stripHtml, wrapHtmlFragment } from '@/lib/email/html'
import HtmlEmailViewer from './HtmlEmailViewer'

const OUTBOUND_CHANNELS = new Set(['gmail', 'facebook', 'instagram'])

interface AttachmentChip {
  id: string
  name: string
  mimeType: string
  size: number
  msgId: string
}

function parseAttachments(content: string): { cleanContent: string; attachments: AttachmentChip[] } {
  const match = content.match(/<!--CBBA_ATT:(.+?)-->\s*$/)
  if (!match) return { cleanContent: content, attachments: [] }
  try {
    const parsed = JSON.parse(match[1]) as { msgId: string; items: Array<{ id: string; name: string; mimeType: string; size: number }> }
    return {
      cleanContent: content.slice(0, content.length - match[0].length),
      attachments: parsed.items.map((item) => ({ ...item, msgId: parsed.msgId })),
    }
  } catch {
    return { cleanContent: content, attachments: [] }
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isHtml(content: string): boolean {
  return looksLikeHtml(content)
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/gi

function linkifyText(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(URL_RE.source, URL_RE.flags)
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const href = match[0]
    parts.push(
      <a
        key={`${match.index}-${href}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:opacity-80 break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {href}
      </a>
    )
    lastIndex = match.index + href.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : [text]
}

interface ContactInfo {
  full_name: string | null
  email: string | null
}

interface MessageBubbleProps {
  message: MessageWithSender
  currentUserId: string
  channel: string
  defaultExpanded?: boolean
  contact?: ContactInfo | null
  /** Conversation inbox address — fallback when message.from_address is null */
  inboxFromAddress?: string | null
}

function resolveSender(
  message: MessageWithSender,
  currentUserId: string,
  contact?: ContactInfo | null,
  inboxFromAddress?: string | null
): { name: string; subtitle: string | null; initial: string } {
  if (message.sender_type === 'ai') {
    return { name: 'AI Assistant', subtitle: null, initial: 'AI' }
  }

  if (message.sender_type === 'contact') {
    const email = message.from_address?.trim() || contact?.email || null
    const name = message.from_name?.trim() || contact?.full_name?.trim() || email || 'Contact'
    return {
      name,
      subtitle: email && email !== name ? email : null,
      initial: name.charAt(0).toUpperCase(),
    }
  }

  // Staff: show who sent it, and which inbox address the email went out from
  const isCurrentUser = message.sender_id === currentUserId
  const name = message.sender?.full_name?.trim() || (isCurrentUser ? 'You' : 'Staff')
  const fromAddress = message.from_address?.trim() || inboxFromAddress?.trim() || null
  return {
    name,
    subtitle: fromAddress ? `via ${fromAddress}` : null,
    initial: name.charAt(0).toUpperCase(),
  }
}

export default function MessageBubble({
  message,
  currentUserId,
  channel,
  defaultExpanded = true,
  contact = null,
  inboxFromAddress = null,
}: MessageBubbleProps) {
  const isOutbound = message.sender_type === 'staff' || message.sender_type === 'ai'
  const isNote = message.is_internal_note
  const { cleanContent, attachments } = parseAttachments(message.content)
  const contentIsHtml = isHtml(cleanContent)
  const showSent = isOutbound && !isNote && message.sender_type === 'staff' && OUTBOUND_CHANNELS.has(channel)
  const isEmailChannel = channel === 'gmail'
  const sender = resolveSender(message, currentUserId, contact, inboxFromAddress)

  const previewText = contentIsHtml
    ? stripHtml(cleanContent).replace(/\s+/g, ' ').slice(0, 90)
    : cleanContent.replace(/\s+/g, ' ').slice(0, 90)

  const [expanded, setExpanded] = useState(defaultExpanded)

  if (isNote) {
    return (
      <div className="px-4 py-1.5">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Internal Note</span>
            {message.sender?.full_name && (
              <span className="text-xs text-gray-400 tracking-tight">{message.sender.full_name}</span>
            )}
            <span className="text-xs text-gray-500 ml-auto tabular-nums">{formatDateTime(message.created_at)}</span>
          </div>
          <p className="text-sm text-amber-100/80 whitespace-pre-wrap leading-[1.55]">{message.content}</p>
        </div>
      </div>
    )
  }

  if (contentIsHtml || isEmailChannel) {
    const plainText = contentIsHtml ? stripHtml(cleanContent) : cleanContent

    return (
      <div className="px-4 py-1">
        <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-cbba-navy-light shadow-sm shadow-black/5">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 bg-cbba-navy-light [@media(hover:hover)]:hover:bg-white/[0.04] active:scale-[0.995] transition-[background-color,transform] duration-150 ease-out text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 select-none tracking-tight ${
              isOutbound ? 'bg-cbba-purple/30 text-cbba-purple-light' : 'bg-white/10 text-gray-200'
            }`}>
              {message.sender_type === 'ai' ? 'AI' : sender.initial}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-[13px] font-semibold text-white tracking-tight truncate leading-tight">
                  {sender.name}
                </span>
                {sender.subtitle && (
                  <span className="text-[11px] text-gray-400 truncate hidden sm:inline tracking-tight">
                    {sender.subtitle}
                  </span>
                )}
              </div>
              {sender.subtitle && (
                <p className="text-[11px] text-gray-400 truncate sm:hidden mt-0.5 tracking-tight">{sender.subtitle}</p>
              )}
              {!expanded && previewText && (
                <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-snug tracking-tight">
                  {previewText}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {message.sender_type === 'ai' && <AiBadge />}
              {showSent && <SentBadge />}
              <span className="text-[11px] text-gray-400 whitespace-nowrap tabular-nums tracking-tight">
                {formatDateTime(message.created_at)}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ease-out flex-shrink-0 ${expanded ? '' : '-rotate-90'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expanded && (
            <div className="border-t border-white/[0.05]">
              {contentIsHtml ? (
                <>
                  <HtmlEmailViewer html={wrapHtmlFragment(cleanContent)} />
                  {attachments.length > 0 && (
                    <div className="px-4 py-3 border-t border-white/[0.05]">
                      <AttachmentChips attachments={attachments} conversationId={message.conversation_id} />
                    </div>
                  )}
                </>
              ) : (
                <div className="px-5 py-4">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap leading-[1.55] tracking-tight">{linkifyText(plainText)}</p>
                  {attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/[0.05]">
                      <AttachmentChips attachments={attachments} conversationId={message.conversation_id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`px-4 py-1.5 flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] space-y-1 flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center gap-2 min-w-0 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`min-w-0 ${isOutbound ? 'text-right' : 'text-left'}`}>
            <span className="text-xs font-semibold text-gray-300 tracking-tight">{sender.name}</span>
            {sender.subtitle && (
              <span className="text-[10px] text-gray-400 ml-1.5 tracking-tight">{sender.subtitle}</span>
            )}
          </div>
          {message.sender_type === 'ai' && <AiBadge />}
          <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums tracking-tight">{formatDateTime(message.created_at)}</span>
        </div>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words leading-[1.55] tracking-tight ${
          isOutbound
            ? 'bg-cbba-purple text-white rounded-tr-sm'
            : 'bg-cbba-navy-light border border-white/10 text-gray-200 rounded-tl-sm'
        }`}>
          {linkifyText(cleanContent)}
        </div>
        {attachments.length > 0 && (
          <AttachmentChips attachments={attachments} conversationId={message.conversation_id} />
        )}
        {showSent && (
          <div className="flex justify-end">
            <SentBadge />
          </div>
        )}
      </div>
    </div>
  )
}

function getFileTypeLabel(mimeType: string, name: string): { label: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase()
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ext === 'csv' || ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    return { label: 'XLS', color: 'text-green-400' }
  }
  if (mimeType.includes('wordprocessing') || mimeType.includes('msword') || ext === 'doc' || ext === 'docx') {
    return { label: 'DOC', color: 'text-blue-400' }
  }
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return { label: 'PDF', color: 'text-red-400' }
  }
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || ext === 'ppt' || ext === 'pptx') {
    return { label: 'PPT', color: 'text-orange-400' }
  }
  if (mimeType.startsWith('image/')) {
    return { label: 'IMG', color: 'text-purple-400' }
  }
  return { label: 'FILE', color: 'text-gray-400' }
}

function AttachmentChips({ attachments, conversationId }: { attachments: AttachmentChip[]; conversationId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((att) => {
        const { label, color } = getFileTypeLabel(att.mimeType, att.name)
        return (
          <a
            key={att.id}
            href={`/api/conversations/${conversationId}/attachment?msgId=${encodeURIComponent(att.msgId)}&attId=${encodeURIComponent(att.id)}&name=${encodeURIComponent(att.name)}`}
            download={att.name}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-white hover:border-white/25 active:scale-[0.97] transition-[color,border-color,transform] duration-150 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            <span className={`text-[10px] font-bold flex-shrink-0 ${color}`}>{label}</span>
            <span className="max-w-[180px] truncate">{att.name}</span>
            {att.size > 0 && <span className="text-gray-500 flex-shrink-0">{formatFileSize(att.size)}</span>}
          </a>
        )
      })}
    </div>
  )
}

function SentBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      Sent
    </span>
  )
}

function AiBadge() {
  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-cbba-orange/20 text-cbba-orange border border-cbba-orange/30 rounded-full font-medium">
      AI
    </span>
  )
}
