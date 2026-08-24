'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppUser } from '@/contexts/AppUserContext'
import { useUsers } from '@/lib/hooks/useUsers'
import ChannelIcon from '@/components/ui/ChannelIcon'
import MessageThread from './MessageThread'
import ReplyBox from './ReplyBox'
import ConversationSidebar from './ConversationSidebar'
import FeedbackEmailModal from './FeedbackEmailModal'
import type { ConversationDetail as ConversationDetailType, FeedbackRequest } from '@/types/database'
import type { Database } from '@/types/supabase'

interface ConversationWithConfig extends ConversationDetailType {
  channel_config: { id: string; identifier: string } | null
}

const STATUS_CLASSES: Record<string, string> = {
  open:        'bg-blue-500/15 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  waiting:     'bg-orange-500/15 text-orange-400 border-orange-500/20',
  closed:      'bg-gray-500/15 text-gray-400 border-gray-500/20',
}
const DEPT_CLASSES: Record<string, string> = {
  Reps:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Comps: 'bg-green-500/15 text-green-400 border-green-500/20',
  LTP:   'bg-purple-500/15 text-purple-400 border-purple-500/20',
  Other: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  Referees: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
}
const PRIORITY_CLASSES: Record<string, string> = {
  low:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  high:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const chevron = (
  <svg className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

type ConversationUpdate = Database['public']['Tables']['conversations']['Update']

const STATUSES = ['open', 'in_progress', 'waiting', 'closed']
const DEPARTMENTS = [
  { value: 'Reps',  label: 'Reps' },
  { value: 'Comps', label: 'Comps' },
  { value: 'LTP',   label: 'Learn to Play' },
  { value: 'Referees', label: 'Referees' },
  { value: 'Other', label: 'Other' },
]
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

interface ConversationDetailProps {
  conversationId: string
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onDeleted?: () => void
  onBack?: () => void
  onSelectConversation?: (id: string) => void
}

export default function ConversationDetail({
  conversationId,
  sidebarOpen,
  onToggleSidebar,
  onDeleted,
  onBack,
  onSelectConversation,
}: ConversationDetailProps) {
  const currentUser = useAppUser()
  const users = useUsers()
  const [conversation, setConversation] = useState<ConversationWithConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [feedbackRequest, setFeedbackRequest] = useState<FeedbackRequest | null>(null)
  const [closing, setClosing] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [lastInboundCc, setLastInboundCc] = useState<string[]>([])
  const [feedbackEmailReady, setFeedbackEmailReady] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setFetchError(false)
    const supabase = createClient()
    supabase
      .from('conversations')
      .select('*, contact:contacts(*), assigned_user:users(id, full_name, avatar_url), channel_config:channel_configs(id, identifier)')
      .eq('id', conversationId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setConversation(null)
          setFetchError(true)
        } else {
          setConversation(data as unknown as ConversationWithConfig)
        }
        setLoading(false)
      })

    // Mark as read
    supabase
      .from('conversations')
      .update({ is_read: true })
      .eq('id', conversationId)
      .eq('is_read', false)
      .then(() => {})

    // Fetch feedback request for this conversation
    supabase
      .from('feedback_requests')
      .select('*')
      .eq('conversation_id', conversationId)
      .maybeSingle()
      .then(({ data }) => {
        setFeedbackRequest(data as FeedbackRequest | null)
      })

    // Fetch other recipients from the last inbound message (for Reply All)
    supabase
      .from('messages')
      .select('cc_addresses')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'contact')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { cc_addresses?: string[] | null } | null
        setLastInboundCc(row?.cc_addresses ?? [])
      })

    // Realtime: refresh joined contact/inbox when this conversation is updated
    const channel = supabase
      .channel(`conversation-detail-${conversationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `id=eq.${conversationId}`,
      }, () => {
        supabase
          .from('conversations')
          .select('*, contact:contacts(*), assigned_user:users(id, full_name, avatar_url), channel_config:channel_configs(id, identifier)')
          .eq('id', conversationId)
          .single()
          .then(({ data }) => {
            if (data) setConversation(data as unknown as ConversationWithConfig)
          })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  async function updateConversation(updates: ConversationUpdate) {
    const enriched = { ...updates }

    // When assigning to a user: auto-fill department from that user's department
    if (enriched.assigned_to) {
      const assignedUser = users.find((u) => u.id === enriched.assigned_to)
      if (assignedUser?.department) {
        enriched.department = assignedUser.department
      }
    }

    // When setting department (not alongside an assignment): auto-assign if exactly one user matches
    if (enriched.department && !('assigned_to' in updates)) {
      const deptUsers = users.filter((u) => u.department === enriched.department)
      if (deptUsers.length === 1) {
        enriched.assigned_to = deptUsers[0].id
      }
    }

    setUpdateError(null)
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enriched),
    })
    if (res.ok) {
      const data = await res.json()
      setConversation(data as unknown as ConversationWithConfig)
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string }
      setUpdateError(err.error ?? 'Update failed')
      setTimeout(() => setUpdateError(null), 3000)
    }
  }

  async function closeConversation() {
    setClosing(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/close`, { method: 'POST' })
      if (res.ok) {
        const json = await res.json() as {
          ok: boolean
          feedbackToken: string | null
          contactEmail: string | null
          contactName: string | null
          subject: string | null
        }
        setConversation((prev) => prev ? { ...prev, status: 'closed' } : prev)
        if (json.feedbackToken && json.contactEmail) {
          setFeedbackEmailReady(true)
        }
        // Refresh feedback request from DB
        const supabase = createClient()
        const { data } = await supabase
          .from('feedback_requests')
          .select('*')
          .eq('conversation_id', conversationId)
          .maybeSingle()
        setFeedbackRequest(data as FeedbackRequest | null)
      }
    } finally {
      setClosing(false)
    }
  }

  function buildFeedbackEmailContent(): { to: string; subject: string; body: string } | null {
    if (!feedbackRequest || !feedbackRequest.contact_email) return null
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const feedbackUrl = `${origin}/api/feedback/${feedbackRequest.token}`
    const name = feedbackRequest.contact_name ?? 'there'
    return {
      to: feedbackRequest.contact_email,
      subject: 'How did we go? Share your feedback',
      body: `Hi ${name},\n\nThank you for contacting CBBA Storm Basketball. We hope we were able to help you today.\n\nWe'd love to hear how your experience was. It only takes 30 seconds:\n\n${feedbackUrl}\n\nThanks,\nCBBA Storm Basketball Team`,
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-xs text-gray-500">Loading...</div>
      </div>
    )
  }

  if (fetchError || !conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-sm text-gray-400">Conversation not found or you don&apos;t have access.</p>
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs text-cbba-purple hover:text-cbba-purple-light transition-colors"
          >
            Back to inbox
          </button>
        )}
      </div>
    )
  }

  const { contact, assigned_user } = conversation

  return (
    <div className="flex h-full">
      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3.5 border-b border-white/5 bg-cbba-navy">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              {onBack && (
                <button
                  onClick={onBack}
                  className="md:hidden p-1.5 -ml-1 text-gray-400 [@media(hover:hover)]:hover:text-white active:scale-[0.97] transition-[color,transform] duration-150 ease-out mr-1 flex-shrink-0 mt-0.5"
                  aria-label="Back to conversations"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <ChannelIcon channel={conversation.channel} className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-white tracking-tight truncate">
                  {conversation.subject ?? 'No subject'}
                </h2>
                <p className="text-xs text-gray-300 mt-0.5 truncate tracking-tight">
                  {contact?.full_name ?? contact?.email ?? 'Unknown contact'}
                </p>
                {contact?.email && contact.email !== contact.full_name && (
                  <p className="text-[11px] text-gray-400 truncate tracking-tight">{contact.email}</p>
                )}
                {conversation.channel === 'gmail' && conversation.channel_config?.identifier && (
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 truncate tracking-tight">
                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Inbox {conversation.channel_config.identifier}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Reopen button for closed conversations */}
              {conversation.status === 'closed' && (
                <button
                  onClick={() => updateConversation({ status: 'open' })}
                  className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 [@media(hover:hover)]:hover:bg-white/10 [@media(hover:hover)]:hover:text-white active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out"
                >
                  Reopen
                </button>
              )}
              {/* Toggle sidebar */}
              <button
                onClick={onToggleSidebar}
                title={sidebarOpen ? 'Hide details' : 'Show details'}
                className={`p-1.5 rounded-lg active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out ${
                  sidebarOpen ? 'bg-white/10 text-white' : 'text-gray-400 [@media(hover:hover)]:hover:bg-white/5 [@media(hover:hover)]:hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Attributes row */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {/* Status */}
            <div className="relative inline-flex items-center">
              <select
                value={conversation.status}
                onChange={(e) => {
                  const newStatus = e.target.value
                  if (newStatus === 'closed') closeConversation()
                  else updateConversation({ status: newStatus })
                }}
                disabled={closing}
                className={`appearance-none cursor-pointer rounded-full pl-2.5 pr-6 py-0.5 text-xs font-medium border focus:outline-none disabled:cursor-not-allowed ${STATUS_CLASSES[conversation.status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'}`}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {chevron}
            </div>

            <span className="text-gray-700">|</span>

            {/* Department */}
            <div className="relative inline-flex items-center">
              <select
                value={conversation.department ?? ''}
                onChange={(e) => updateConversation({ department: e.target.value || null })}
                className={`appearance-none cursor-pointer rounded-full pl-2.5 pr-6 py-0.5 text-xs font-medium border focus:outline-none ${
                  conversation.department
                    ? (DEPT_CLASSES[conversation.department] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20')
                    : 'bg-white/5 text-gray-500 border-white/10'
                }`}
              >
                <option value="">No department</option>
                {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              {chevron}
            </div>

            <span className="text-gray-700">|</span>

            {/* Priority */}
            <div className="relative inline-flex items-center">
              <select
                value={conversation.priority}
                onChange={(e) => updateConversation({ priority: e.target.value })}
                className={`appearance-none cursor-pointer rounded-full pl-2.5 pr-6 py-0.5 text-xs font-medium border focus:outline-none ${PRIORITY_CLASSES[conversation.priority] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              {chevron}
            </div>

            <span className="text-gray-700">|</span>

            {/* Assign to */}
            <div className="relative inline-flex items-center">
              <select
                value={assigned_user?.id ?? ''}
                onChange={(e) => updateConversation({ assigned_to: e.target.value || null })}
                className="appearance-none cursor-pointer rounded-full pl-2.5 pr-6 py-0.5 text-xs font-medium border bg-white/5 text-gray-300 border-white/10 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
                ))}
              </select>
              {chevron}
            </div>

            {/* Feedback */}
            {conversation.status === 'closed' && feedbackRequest && (
              <div className="flex items-center gap-2">
                {feedbackRequest.rating ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-xs">
                    <span className="text-[#FBB33F]">{'★'.repeat(feedbackRequest.rating)}{'☆'.repeat(5 - feedbackRequest.rating)}</span>
                    <span className="text-gray-400">{feedbackRequest.rating}/5</span>
                  </div>
                ) : feedbackRequest.contact_email ? (
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      feedbackEmailReady
                        ? 'bg-[#604484] text-white hover:bg-[#7a5ba0]'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    Send feedback email
                  </button>
                ) : (
                  <span className="text-xs text-gray-600">No email on file</span>
                )}
              </div>
            )}

            {/* More menu */}
            <div className="ml-auto relative">
              <button
                onClick={() => setShowMoreMenu((v) => !v)}
                className="p-1 rounded text-gray-500 hover:text-white transition-colors"
                aria-label="More options"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-8 w-52 bg-cbba-navy-light border border-white/10 rounded-lg shadow-xl z-10 py-1">
                  <button
                    onClick={async () => {
                      setShowMoreMenu(false)
                      await fetch(`/api/conversations/${conversationId}/mark-unread`, { method: 'POST' })
                      onDeleted?.()
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Mark as unread{conversation.channel === 'gmail' ? ' (and Gmail)' : ''}
                  </button>
                  <div className="my-1 border-t border-white/5" />
                  {/* Snooze options */}
                  {[
                    { label: 'Snooze 1 hour', preset: '1h' },
                    { label: 'Snooze until later today', preset: 'later' },
                    { label: 'Snooze until tomorrow', preset: 'tomorrow' },
                    { label: 'Snooze until next week', preset: 'week' },
                  ].map(({ label, preset }) => (
                    <button
                      key={preset}
                      onClick={async () => {
                        setShowMoreMenu(false)
                        const d = new Date()
                        if (preset === '1h') d.setHours(d.getHours() + 1)
                        else if (preset === 'later') { d.setHours(17, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1) }
                        else if (preset === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0) }
                        else if (preset === 'week') { d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0) }
                        await fetch(`/api/conversations/${conversationId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ snoozed_until: d.toISOString() }),
                        })
                        onDeleted?.()
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                  {conversation.snoozed_until && (
                    <button
                      onClick={async () => {
                        setShowMoreMenu(false)
                        await fetch(`/api/conversations/${conversationId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ snoozed_until: null }),
                        })
                        onDeleted?.()
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      Unsnooze
                    </button>
                  )}
                  <div className="my-1 border-t border-white/5" />
                  <button
                    onClick={() => {
                      closeConversation()
                      setShowMoreMenu(false)
                    }}
                    disabled={closing}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {closing ? 'Closing...' : 'Mark as closed'}
                  </button>
                  <button
                    onClick={async () => {
                      setShowMoreMenu(false)
                      await fetch(`/api/conversations/${conversationId}/archive`, { method: 'POST' })
                      onDeleted?.()
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    Archive{conversation.channel === 'gmail' ? ' (and Gmail)' : ''}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Delete this conversation? This cannot be undone.')) return
                      setShowMoreMenu(false)
                      await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' })
                      onDeleted?.()
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Delete{conversation.channel === 'gmail' ? ' (and Gmail trash)' : ''}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Update error toast */}
        {updateError && (
          <div className="flex-shrink-0 mx-5 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {updateError}
          </div>
        )}

        {/* Messages */}
        <MessageThread
          conversationId={conversationId}
          currentUserId={currentUser.id}
          channel={conversation.channel}
          contact={conversation.contact ? {
            full_name: conversation.contact.full_name,
            email: conversation.contact.email,
          } : null}
          inboxFromAddress={conversation.channel_config?.identifier ?? null}
        />

        {/* Reply box */}
        <ReplyBox
          conversationId={conversationId}
          channel={conversation.channel}
          contactEmail={(conversation.contact as unknown as { email?: string | null })?.email ?? null}
          contactName={(conversation.contact as unknown as { full_name?: string | null })?.full_name ?? null}
          subject={conversation.subject}
          lastInboundCc={lastInboundCc}
          channelConfigId={conversation.channel_config_id ?? null}
          fromEmail={conversation.channel_config?.identifier ?? null}
          onSent={() => {
            const supabase = createClient()
            supabase
              .from('conversations')
              .select('*, contact:contacts(*), assigned_user:users(id, full_name, avatar_url), channel_config:channel_configs(id, identifier)')
              .eq('id', conversationId)
              .single()
              .then(({ data }) => {
                if (data) setConversation(data as unknown as ConversationWithConfig)
              })
          }}
        />
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <ConversationSidebar
          conversation={conversation}
          onClose={onToggleSidebar}
          onSelectConversation={onSelectConversation}
        />
      )}

      {/* Feedback email modal */}
      {showFeedbackModal && feedbackRequest && (() => {
        const emailContent = buildFeedbackEmailContent()
        return emailContent ? (
          <FeedbackEmailModal
            conversationId={conversationId}
            channelConfigId={conversation.channel_config_id ?? null}
            initialTo={emailContent.to}
            initialSubject={emailContent.subject}
            initialBody={emailContent.body}
            fromEmail={conversation.channel_config_id ? undefined : undefined}
            onClose={() => setShowFeedbackModal(false)}
            onSent={() => {
              setShowFeedbackModal(false)
              setFeedbackEmailReady(false)
            }}
          />
        ) : null
      })()}
    </div>
  )
}
