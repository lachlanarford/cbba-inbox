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
        sender:users(id, full_name, avatar_url, email)
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
          const inserted = payload.new as { id: string }
          // Refetch the joined row so staff name/email are available (realtime payload has no joins)
          void (async () => {
            const { data } = await supabase
              .from('messages')
              .select('*, sender:users(id, full_name, avatar_url, email)')
              .eq('id', inserted.id)
              .single()
            if (!data) return
            setMessages((prev) => {
              if (prev.some((m) => m.id === inserted.id)) return prev
              return [...prev, data as unknown as MessageWithSender]
            })
          })()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, fetchMessages])

  return { messages, loading, refetch: fetchMessages }
}
