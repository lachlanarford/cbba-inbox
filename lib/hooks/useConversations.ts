'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConversationListItem, InboxFilters } from '@/types/database'

export function useConversations(filters: InboxFilters) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversations = useCallback(async () => {
    const supabase = createClient()

    let query = supabase
      .from('conversations')
      .select(`
        *,
        contact:contacts(id, full_name, email, phone),
        assigned_user:users(id, full_name, avatar_url)
      `)
      .order('last_message_at', { ascending: false })

    if (filters.status !== 'all' && filters.status !== '') {
      query = query.eq('status', filters.status)
    }
    if (filters.department) {
      query = query.eq('department', filters.department)
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority)
    }
    if (filters.channel) {
      query = query.eq('channel', filters.channel)
    }
    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    let results = (data ?? []) as unknown as ConversationListItem[]

    // Client-side search across contact name and subject
    if (filters.search) {
      const term = filters.search.toLowerCase()
      results = results.filter(
        (c) =>
          c.subject?.toLowerCase().includes(term) ||
          c.contact?.full_name?.toLowerCase().includes(term)
      )
    }

    setConversations(results)
    setLoading(false)
    setError(null)
  }, [
    filters.status,
    filters.department,
    filters.priority,
    filters.channel,
    filters.assignedTo,
    filters.search,
  ])

  useEffect(() => {
    setLoading(true)
    fetchConversations()

    const supabase = createClient()
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchConversations()
      })
      .subscribe()

    // Polling fallback in case Realtime misses an event
    const poll = setInterval(fetchConversations, 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [fetchConversations])

  return { conversations, loading, error, refetch: fetchConversations }
}
