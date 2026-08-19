'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils/time'
import StatusBadge from '@/components/ui/StatusBadge'
import ChannelIcon from '@/components/ui/ChannelIcon'
import type { ConversationDetail, ConversationListItem } from '@/types/database'

interface ConversationSidebarProps {
  conversation: ConversationDetail
  onClose: () => void
  onSelectConversation?: (id: string) => void
}

export default function ConversationSidebar({ conversation, onClose, onSelectConversation }: ConversationSidebarProps) {
  const [otherConversations, setOtherConversations] = useState<ConversationListItem[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('conversations')
      .select('*, contact:contacts(id, full_name, email, phone), assigned_user:users(id, full_name, avatar_url)')
      .eq('contact_id', conversation.contact_id)
      .neq('id', conversation.id)
      .order('last_message_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setOtherConversations((data ?? []) as unknown as ConversationListItem[]))
  }, [conversation.contact_id, conversation.id])

  const { contact } = conversation

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-l border-white/5 bg-cbba-navy-dark overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</span>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-500 hover:text-white transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        {/* Contact */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact</h3>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-white">{contact.full_name ?? 'Unknown'}</p>
              {contact.email && (
                <p className="text-xs text-gray-400 mt-0.5 break-all">{contact.email}</p>
              )}
            </div>
            {contact.phone && (
              <p className="text-xs text-gray-400">{contact.phone}</p>
            )}
            {contact.channel && (
              <div className="flex items-center gap-1.5">
                <ChannelIcon channel={contact.channel} className="w-3.5 h-3.5" showLabel />
              </div>
            )}
            <Link
              href={`/contacts/${contact.id}`}
              className="inline-flex items-center gap-1 text-xs text-cbba-purple hover:text-cbba-purple-light transition-colors mt-1"
            >
              View contact profile
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Timestamps */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Timeline</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Created</span>
              <span className="text-gray-300">{formatDate(conversation.created_at)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Last message</span>
              <span className="text-gray-300">{formatDateTime(conversation.last_message_at)}</span>
            </div>
            {conversation.closed_at && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Closed</span>
                <span className="text-gray-300">{formatDate(conversation.closed_at)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Previous conversations */}
        {otherConversations.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Other conversations ({otherConversations.length})
            </h3>
            <div className="space-y-2">
              {otherConversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectConversation?.(c.id)}
                  className="w-full text-left p-2 rounded-lg bg-white/5 space-y-1 [@media(hover:hover)]:hover:bg-white/10 transition-colors"
                >
                  <p className="text-xs text-gray-300 truncate">{c.subject ?? 'No subject'}</p>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={c.status} />
                    <ChannelIcon channel={c.channel} className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}
