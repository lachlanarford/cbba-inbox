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
  const topRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const prevCount = useRef(0)

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      prevCount.current = messages.length
      return
    }
    if (messages.length > prevCount.current) {
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevCount.current = messages.length
  }, [messages.length])

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

  const reversed = [...messages].reverse()

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-0.5">
      <div ref={topRef} />
      {reversed.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          channel={channel}
          defaultExpanded={index === 0}
        />
      ))}
    </div>
  )
}
