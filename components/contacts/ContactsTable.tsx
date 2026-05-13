'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/time'
import ChannelIcon from '@/components/ui/ChannelIcon'
import type { Contact } from '@/types/database'

interface ContactRow extends Contact {
  conversation_count: number
}

export default function ContactsTable() {
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return }
        // Fetch conversation counts
        const ids = data.map((c) => c.id)
        const { data: counts } = await supabase
          .from('conversations')
          .select('contact_id')
          .in('contact_id', ids)

        const countMap: Record<string, number> = {}
        for (const row of counts ?? []) {
          countMap[row.contact_id] = (countMap[row.contact_id] ?? 0) + 1
        }

        setContacts(
          (data as Contact[]).map((c) => ({
            ...c,
            conversation_count: countMap[c.id] ?? 0,
          }))
        )
        setLoading(false)
      })
  }, [])

  const filtered = contacts.filter((c) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      c.full_name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-cbba-navy-light border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['Name', 'Email', 'Phone', 'Channel', 'Conversations', 'Created'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-white/5 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                  {search ? 'No contacts match your search.' : 'No contacts yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${contact.id}`} className="text-sm font-medium text-white hover:text-cbba-gold transition-colors">
                      {contact.full_name ?? 'Unknown'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{contact.email ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{contact.phone ?? '-'}</td>
                  <td className="px-4 py-3">
                    {contact.channel ? (
                      <ChannelIcon channel={contact.channel} className="w-4 h-4" showLabel />
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-300">{contact.conversation_count}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(contact.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
