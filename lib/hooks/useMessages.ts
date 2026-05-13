'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MessageWithSender } from '@/types/database'

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [loading, setLoading] = useState(false)

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users(id, full_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    setMessages((data ?? []) as unknown as MessageWithSender[])
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    fetchMessages()

    if (!conversationId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Append new message immediately without a full refetch
          setMessages((prev) => [...prev, payload.new as MessageWithSender])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, fetchMessages])

  return { messages, loading, refetch: fetchMessages }
}
