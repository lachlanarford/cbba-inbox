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

interface MessageBubbleProps {
  message: MessageWithSender
  currentUserId: string
  channel: string
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

export default function MessageBubble({ message, currentUserId, channel }: MessageBubbleProps) {
  const isOutbound = message.sender_type === 'staff' || message.sender_type === 'ai'
  const isCurrentUser = message.sender_id === currentUserId
  const isNote = message.is_internal_note
  const { cleanContent, attachments } = parseAttachments(message.content)
  const contentIsHtml = isHtml(cleanContent)
  const showSent = isOutbound && !isNote && message.sender_type === 'staff' && OUTBOUND_CHANNELS.has(channel)

  if (isNote) {
    return (
      <div className="px-4 py-2">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
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

  // HTML email — render full-width below the sender line
  if (contentIsHtml) {
    return (
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-400">
            {message.sender_type === 'contact'
              ? 'Contact'
              : message.sender?.full_name ?? (isCurrentUser ? 'You' : 'Staff')}
          </span>
          {message.sender_type === 'ai' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-cbba-orange/20 text-cbba-orange border border-cbba-orange/30 rounded-full font-medium">
              AI
            </span>
          )}
          <span className="text-xs text-gray-600">{formatDateTime(message.created_at)}</span>
          {showSent && <SentBadge />}
        </div>
        <HtmlEmailViewer html={cleanContent} />
        {attachments.length > 0 && (
          <AttachmentChips attachments={attachments} conversationId={message.conversation_id} />
        )}
      </div>
    )
  }

  return (
    <div className={`px-4 py-1.5 flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] space-y-1 ${isOutbound ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Sender name + time */}
        <div className={`flex items-center gap-2 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs font-medium text-gray-400">
            {message.sender_type === 'contact'
              ? 'Contact'
              : message.sender?.full_name ?? (isCurrentUser ? 'You' : 'Staff')}
          </span>
          {message.sender_type === 'ai' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-cbba-orange/20 text-cbba-orange border border-cbba-orange/30 rounded-full font-medium">
              AI
            </span>
          )}
          <span className="text-xs text-gray-600">{formatDateTime(message.created_at)}</span>
        </div>

        {/* Bubble */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            isOutbound
              ? 'bg-cbba-purple text-white rounded-tr-sm'
              : 'bg-cbba-navy-light border border-white/10 text-gray-200 rounded-tl-sm'
          }`}
        >
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
    <div className="flex flex-wrap gap-2 mt-2">
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
