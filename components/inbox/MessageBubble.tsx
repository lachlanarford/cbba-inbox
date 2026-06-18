'use client'

import { useState } from 'react'
import type { MessageWithSender } from '@/types/database'
import { formatDateTime } from '@/lib/utils/time'
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
  const trimmed = content.trimStart()
  return trimmed.startsWith('<') && (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<div') ||
    trimmed.startsWith('<p') ||
    trimmed.startsWith('<table') ||
    /<[a-z][\s\S]*>/i.test(trimmed.slice(0, 200))
  )
}

// Rich HTML needs the iframe sandbox (has tables, external images, complex CSS)
function isRichHtml(html: string): boolean {
  const lower = html.toLowerCase()
  return lower.includes('<table') || lower.includes('<img')
}

// Strip HTML tags to plain readable text for previews and simple rendering
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface MessageBubbleProps {
  message: MessageWithSender
  currentUserId: string
  channel: string
  defaultExpanded?: boolean
}

export default function MessageBubble({ message, currentUserId, channel, defaultExpanded = true }: MessageBubbleProps) {
  const isOutbound = message.sender_type === 'staff' || message.sender_type === 'ai'
  const isCurrentUser = message.sender_id === currentUserId
  const isNote = message.is_internal_note
  const { cleanContent, attachments } = parseAttachments(message.content)
  const contentIsHtml = isHtml(cleanContent)
  const useIframe = contentIsHtml && isRichHtml(cleanContent)
  const showSent = isOutbound && !isNote && message.sender_type === 'staff' && OUTBOUND_CHANNELS.has(channel)
  const isEmailChannel = channel === 'gmail'

  const senderName = message.sender_type === 'contact'
    ? 'Contact'
    : message.sender?.full_name ?? (isCurrentUser ? 'You' : 'Staff')
  const senderInitial = senderName.charAt(0).toUpperCase()

  // Preview text for collapsed cards
  const previewText = contentIsHtml
    ? stripHtml(cleanContent).replace(/\s+/g, ' ').slice(0, 90)
    : cleanContent.replace(/\s+/g, ' ').slice(0, 90)

  const [expanded, setExpanded] = useState(defaultExpanded)

  // Internal note
  if (isNote) {
    return (
      <div className="px-4 py-1.5">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">Internal Note</span>
            <span className="text-xs text-gray-500">{formatDateTime(message.created_at)}</span>
            {message.sender && (
              <span className="text-xs text-gray-500">{message.sender.full_name}</span>
            )}
          </div>
          <p className="text-sm text-amber-100/80 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  // Email card (HTML or plain text on email channel)
  if (contentIsHtml || isEmailChannel) {
    const plainText = contentIsHtml ? stripHtml(cleanContent) : cleanContent

    return (
      <div className="px-4 py-1">
        <div className="rounded-xl overflow-hidden border border-white/[0.07]">
          {/* Header */}
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 bg-cbba-navy-light hover:bg-white/[0.035] transition-colors text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            {/* Avatar */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 select-none ${
              isOutbound ? 'bg-cbba-purple/35 text-cbba-purple-light' : 'bg-white/10 text-gray-300'
            }`}>
              {message.sender_type === 'ai' ? 'AI' : senderInitial}
            </div>

            {/* Sender + preview */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-white">{senderName}</span>
              {!expanded && previewText && (
                <span className="ml-2 text-xs text-gray-500 truncate inline-block max-w-[240px] align-bottom">
                  {previewText}
                </span>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {message.sender_type === 'ai' && <AiBadge />}
              {showSent && <SentBadge />}
              <span className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(message.created_at)}</span>
              <svg
                className={`w-3.5 h-3.5 text-gray-600 transition-transform duration-200 flex-shrink-0 ${expanded ? '' : '-rotate-90'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* Body */}
          {expanded && (
            <div className="border-t border-white/[0.05]">
              {useIframe ? (
                <>
                  <HtmlEmailViewer html={cleanContent} />
                  {attachments.length > 0 && (
                    <div className="px-4 py-3 border-t border-white/[0.05]">
                      <AttachmentChips attachments={attachments} conversationId={message.conversation_id} />
                    </div>
                  )}
                </>
              ) : (
                <div className="px-5 py-4">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{plainText}</p>
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

  // Plain-text / social chat bubble
  return (
    <div className={`px-4 py-1.5 flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] space-y-1 flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}>
        <div className={`flex items-center gap-2 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs font-medium text-gray-400">{senderName}</span>
          {message.sender_type === 'ai' && <AiBadge />}
          <span className="text-xs text-gray-600">{formatDateTime(message.created_at)}</span>
        </div>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
          isOutbound
            ? 'bg-cbba-purple text-white rounded-tr-sm'
            : 'bg-cbba-navy-light border border-white/10 text-gray-200 rounded-tl-sm'
        }`}>
          {cleanContent}
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

function AttachmentChips({ attachments, conversationId }: { attachments: AttachmentChip[]; conversationId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((att) => (
        <a
          key={att.id}
          href={`/api/conversations/${conversationId}/attachment?msgId=${encodeURIComponent(att.msgId)}&attId=${encodeURIComponent(att.id)}&name=${encodeURIComponent(att.name)}`}
          download={att.name}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-white hover:border-white/25 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
          </svg>
          <span className="max-w-[180px] truncate">{att.name}</span>
          {att.size > 0 && <span className="text-gray-500 flex-shrink-0">{formatFileSize(att.size)}</span>}
        </a>
      ))}
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
