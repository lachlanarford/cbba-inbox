'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatDateTime } from '@/lib/utils/time'
import ChannelIcon from '@/components/ui/ChannelIcon'
import StatusBadge from '@/components/ui/StatusBadge'
import DepartmentBadge from '@/components/ui/DepartmentBadge'
import ContactModal from '@/components/contacts/ContactModal'
import type { Contact, Conversation } from '@/types/database'

export default function ContactDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    const { data: contactData } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!contactData) {
      setLoading(false)
      return
    }

    const { data: convData } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', params.id)
      .order('last_message_at', { ascending: false })

    setContact(contactData as Contact)
    setConversations((convData ?? []) as Conversation[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
        <div className="bg-cbba-navy-light border border-white/5 rounded-xl p-5 space-y-4">
          <div className="h-6 w-48 bg-white/5 rounded animate-pulse" />
          <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="max-w-3xl">
        <Link href="/contacts" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to contacts
        </Link>
        <p className="text-sm text-gray-500">Contact not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back link */}
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to contacts
      </Link>

      {/* Contact card */}
      <div className="bg-cbba-navy-light border border-white/5 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-white">{contact.full_name ?? 'Unknown'}</h2>
            {contact.email && <p className="text-sm text-gray-400">{contact.email}</p>}
          </div>
          <div className="flex items-center gap-3">
            {contact.channel && (
              <ChannelIcon channel={contact.channel} className="w-5 h-5" showLabel />
            )}
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              Edit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-white/5">
          <div>
            <p className="text-xs text-gray-500 mb-1">Phone</p>
            <p className="text-sm text-gray-300">{contact.phone ?? '-'}</p>
          </div>
          {contact.social_id && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Social ID</p>
              <p className="text-sm text-gray-300 font-mono">{contact.social_id}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Created</p>
            <p className="text-sm text-gray-300">{formatDate(contact.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Last updated</p>
            <p className="text-sm text-gray-300">{formatDateTime(contact.updated_at)}</p>
          </div>
        </div>
      </div>

      {/* Conversations */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Conversation history ({conversations.length})
        </h3>
        {conversations.length === 0 ? (
          <p className="text-sm text-gray-500">No conversations yet.</p>
        ) : (
          <div className="bg-cbba-navy-light border border-white/5 rounded-xl overflow-hidden">
            {conversations.map((conv, idx) => (
              <div
                key={conv.id}
                className={`px-4 py-3 flex items-center gap-3 ${idx < conversations.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <ChannelIcon channel={conv.channel} className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{conv.subject ?? 'No subject'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(conv.last_message_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {conv.department && <DepartmentBadge department={conv.department} />}
                  <StatusBadge status={conv.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <ContactModal
          mode="edit"
          initial={contact}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setContact((prev) => prev ? { ...prev, ...updated } : prev)
            setShowEdit(false)
          }}
        />
      )}
    </div>
  )
}
