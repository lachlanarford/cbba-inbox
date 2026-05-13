'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppUser } from '@/contexts/AppUserContext'
import type { Contact, Channel, Department, Priority } from '@/types/database'

const CHANNELS: Array<{ value: Channel; label: string }> = [
  { value: 'gmail',     label: 'Gmail' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'form',      label: 'Form' },
  { value: 'chat',      label: 'Chat' },
]
const DEPARTMENTS: Department[] = ['Reps', 'Comps', 'LTP', 'Other']
const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

interface NewConversationModalProps {
  onClose: () => void
  onCreated: (conversationId: string) => void
}

export default function NewConversationModal({ onClose, onCreated }: NewConversationModalProps) {
  const currentUser = useAppUser()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isNewContact, setIsNewContact] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [channel, setChannel] = useState<Channel>('gmail')
  const [subject, setSubject] = useState('')
  const [department, setDepartment] = useState<Department | ''>('')
  const [priority, setPriority] = useState<Priority>('low')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const searchContacts = useCallback(async (term: string) => {
    if (!term.trim()) { setResults([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(5)
    setResults((data ?? []) as Contact[])
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchContacts(search), 250)
    return () => clearTimeout(timer)
  }, [search, searchContacts])

  async function handleSubmit() {
    if (!message.trim()) { setError('Please enter an initial message.'); return }
    if (!selectedContact && !isNewContact) { setError('Please select or create a contact.'); return }
    if (isNewContact && !newContactName.trim()) { setError('Please enter a contact name.'); return }

    setSubmitting(true)
    setError('')
    const supabase = createClient()

    let contactId = selectedContact?.id ?? ''

    if (isNewContact) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          full_name: newContactName.trim(),
          email: newContactEmail.trim() || null,
          channel,
        })
        .select('id')
        .single()
      if (contactError || !newContact) {
        setError('Failed to create contact.')
        setSubmitting(false)
        return
      }
      contactId = newContact.id
    }

    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        contact_id: contactId,
        channel,
        subject: subject.trim() || null,
        department: department || null,
        priority,
        assigned_to: currentUser.id,
      })
      .select('id')
      .single()

    if (convError || !conv) {
      setError('Failed to create conversation.')
      setSubmitting(false)
      return
    }

    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_type: 'staff',
      sender_id: currentUser.id,
      content: message.trim(),
    })

    onCreated(conv.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-cbba-navy-light border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">New Conversation</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Contact search */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Contact</label>
            {!selectedContact && !isNewContact ? (
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors"
                />
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-cbba-navy-dark border border-white/10 rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                    {results.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedContact(c); setSearch('') }}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
                      >
                        <p className="text-sm text-white">{c.full_name ?? 'Unknown'}</p>
                        {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setIsNewContact(true)}
                  className="mt-1.5 text-xs text-cbba-purple hover:text-cbba-purple-light transition-colors"
                >
                  + Create new contact
                </button>
              </div>
            ) : isNewContact ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors"
                />
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors"
                />
                <button onClick={() => setIsNewContact(false)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  Back to search
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 bg-cbba-purple/10 border border-cbba-purple/20 rounded-lg">
                <div>
                  <p className="text-sm text-white">{selectedContact!.full_name ?? 'Unknown'}</p>
                  {selectedContact!.email && <p className="text-xs text-gray-400">{selectedContact!.email}</p>}
                </div>
                <button onClick={() => setSelectedContact(null)} className="text-gray-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Channel */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cbba-purple transition-colors cursor-pointer"
            >
              {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Optional subject"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors"
            />
          </div>

          {/* Department + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department | '')}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cbba-purple transition-colors cursor-pointer"
              >
                <option value="">None</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-cbba-purple transition-colors cursor-pointer"
              >
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Initial message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the first message..."
              rows={4}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-cbba-purple text-white text-sm font-medium rounded-lg hover:bg-cbba-purple-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Conversation'}
          </button>
        </div>
      </div>
    </div>
  )
}
