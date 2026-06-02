'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ConversationListItem, InboxFilters } from '@/types/database'

const PAGE_SIZE = 100

// Fetch a single conversation with its joins — used by realtime handlers
async function fetchOne(id: string): Promise<ConversationListItem | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('conversations')
    .select('*, contact:contacts(id, full_name, email, phone), assigned_user:users(id, full_name, avatar_url)')
    .eq('id', id)
    .single()
  return (data ?? null) as unknown as ConversationListItem | null
}

// Used by realtime handlers to decide whether an updated row belongs in the current view
function passesFilters(c: ConversationListItem, f: InboxFilters): boolean {
  if (f.status !== 'all' && f.status !== '' && c.status !== f.status) return false
  if (f.department && c.department !== f.department) return false
  if (f.priority && c.priority !== f.priority) return false
  if (f.channel && c.channel !== f.channel) return false
  if (f.channelConfigId && c.channel_config_id !== f.channelConfigId) return false
  if (f.assignedTo && c.assigned_to !== f.assignedTo) return false
  if (f.search) {
    const term = f.search.toLowerCase()
    if (
      !c.subject?.toLowerCase().includes(term) &&
      !c.contact?.full_name?.toLowerCase().includes(term) &&
      !c.contact?.email?.toLowerCase().includes(term)
    ) return false
  }
  if (f.email) {
    if (!c.contact?.email?.toLowerCase().includes(f.email.toLowerCase())) return false
  }
  const isSnoozed = c.snoozed_until != null && new Date(c.snoozed_until) > new Date()
  if (f.showSnoozed && !isSnoozed) return false
  if (!f.showSnoozed && isSnoozed) return false
  return true
}

function sortByRecent(list: ConversationListItem[]): ConversationListItem[] {
  return [...list].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  )
}

export function useConversations(filters: InboxFilters) {
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Keep a ref so realtime handlers always see the latest filters without re-subscribing
  const filtersRef = useRef(filters)
  useEffect(() => { filtersRef.current = filters }, [filters])

  // Track total rows fetched from DB so load-more knows its offset
  const totalFetchedRef = useRef(0)

  // Build and run the server-side portion of the query for a given page offset
  const fetchPage = useCallback(async (offset: number, f: InboxFilters) => {
    const supabase = createClient()
    let query = supabase
      .from('conversations')
      .select('*, contact:contacts(id, full_name, email, phone), assigned_user:users(id, full_name, avatar_url)')
      .order('last_message_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (f.status !== 'all' && f.status !== '') query = query.eq('status', f.status)
    if (f.department) query = query.eq('department', f.department)
    if (f.priority) query = query.eq('priority', f.priority)
    if (f.channel) query = query.eq('channel', f.channel)
    if (f.channelConfigId) query = query.eq('channel_config_id', f.channelConfigId)
    if (f.assignedTo) query = query.eq('assigned_to', f.assignedTo)
    if (f.dateFrom) query = query.gte('created_at', f.dateFrom)
    if (f.dateTo) query = query.lte('created_at', f.dateTo + 'T23:59:59')
    if (f.showSnoozed) {
      query = query.not('snoozed_until', 'is', null)
    } else {
      query = query.or('snoozed_until.is.null,snoozed_until.lte.' + new Date().toISOString())
    }

    const { data, error: fetchError } = await query
    return { data: (data ?? []) as unknown as ConversationListItem[], error: fetchError }
  }, [])

  // Apply client-side filters that require join data (search text, email partial match)
  const applyClientFilters = useCallback((data: ConversationListItem[], f: InboxFilters) => {
    let results = data
    if (f.search) {
      const term = f.search.toLowerCase()
      results = results.filter(
        (c) =>
          c.subject?.toLowerCase().includes(term) ||
          c.contact?.full_name?.toLowerCase().includes(term) ||
          c.contact?.email?.toLowerCase().includes(term)
      )
    }
    if (f.email) {
      const term = f.email.toLowerCase()
      results = results.filter((c) => c.contact?.email?.toLowerCase().includes(term))
    }
    return results
  }, [])

  // Full refetch — triggered on mount and whenever filters change
  const fetchConversations = useCallback(async () => {
    const f = filtersRef.current
    const { data, error: fetchError } = await fetchPage(0, f)
    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }
    totalFetchedRef.current = data.length
    setConversations(applyClientFilters(data, f))
    setHasMore(data.length === PAGE_SIZE)
    setLoading(false)
    setError(null)
  }, [fetchPage, applyClientFilters])

  // Append the next page without clearing existing results
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const f = filtersRef.current
    const { data } = await fetchPage(totalFetchedRef.current, f)
    const newRows = applyClientFilters(data, f)
    totalFetchedRef.current += data.length
    setConversations((prev) => {
      const ids = new Set(prev.map((c) => c.id))
      return [...prev, ...newRows.filter((r) => !ids.has(r.id))]
    })
    setHasMore(data.length === PAGE_SIZE)
    setLoadingMore(false)
  }, [fetchPage, applyClientFilters, loadingMore, hasMore])

  // Refetch when filters change
  useEffect(() => {
    setLoading(true)
    totalFetchedRef.current = 0
    fetchConversations()
  }, [
    fetchConversations,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    filters.status, filters.department, filters.priority, filters.channel,
    filters.channelConfigId, filters.assignedTo, filters.search, filters.email,
    filters.dateFrom, filters.dateTo, filters.showSnoozed,
  ])

  // Smart realtime subscription — runs once, uses filtersRef for current filter state
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, async (payload) => {
        const conv = await fetchOne((payload.new as { id: string }).id)
        if (!conv || !passesFilters(conv, filtersRef.current)) return
        setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, async (payload) => {
        const conv = await fetchOne((payload.new as { id: string }).id)
        if (!conv) return
        setConversations((prev) => {
          if (passesFilters(conv, filtersRef.current)) {
            const inList = prev.some((c) => c.id === conv.id)
            return sortByRecent(inList ? prev.map((c) => (c.id === conv.id ? conv : c)) : [conv, ...prev])
          }
          // No longer matches current filters — remove it
          return prev.filter((c) => c.id !== conv.id)
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversations' }, (payload) => {
        setConversations((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // intentionally empty — uses filtersRef to avoid re-subscribing on every filter change

  return { conversations, loading, loadingMore, error, hasMore, loadMore, refetch: fetchConversations }
}
