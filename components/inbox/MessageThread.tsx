'use client'

import { useEffect, useRef } from 'react'
import { useMessages } from '@/lib/hooks/useMessages'
import MessageBubble from './MessageBubble'

interface MessageThreadProps {
  conversationId: string
  currentUserId: string
  channel: string
}

export default function MessageThread({ conversationId, currentUserId, channel }: MessageThreadProps) {
  const { messages, loading } = useMessages(conversationId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-xs text-gray-500">Loading messages...</div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-gray-600">No messages yet</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-0.5">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          channel={channel}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
