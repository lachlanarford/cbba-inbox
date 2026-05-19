import type { MessageWithSender } from '@/types/database'
import { formatDateTime } from '@/lib/utils/time'
import HtmlEmailViewer from './HtmlEmailViewer'

interface MessageBubbleProps {
  message: MessageWithSender
  currentUserId: string
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

export default function MessageBubble({ message, currentUserId }: MessageBubbleProps) {
  const isOutbound = message.sender_type === 'staff' || message.sender_type === 'ai'
  const isCurrentUser = message.sender_id === currentUserId
  const isNote = message.is_internal_note
  const contentIsHtml = isHtml(message.content)

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
        </div>
        <HtmlEmailViewer html={message.content} />
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
          {message.content}
        </div>
      </div>
    </div>
  )
}
