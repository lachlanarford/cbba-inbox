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
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showAddToList, setShowAddToList] = useState(false)
  const [lists, setLists] = useState<{ id: string; name: string }[]>([])
  const [addingToList, setAddingToList] = useState<string | null>(null)
  const [addToListMsg, setAddToListMsg] = useState('')

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

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
    setSelected(new Set())
  }

  const filtered = contacts.filter((c) => {
    if (showArchived ? !c.is_archived : c.is_archived) return false
    if (!search) return true
    const term = search.toLowerCase()
    return (
      c.full_name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    )
  })

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id))

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((c) => c.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function openAddToList() {
    const res = await fetch('/api/contacts/lists')
    if (res.ok) {
      const data = await res.json() as { lists: { id: string; name: string }[] }
      setLists(data.lists)
    }
    setAddToListMsg('')
    setShowAddToList(true)
  }

  async function addToList(listId: string) {
    setAddingToList(listId)
    const res = await fetch(`/api/contacts/lists/${listId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_ids: Array.from(selected) }),
    })
    const data = await res.json() as { added?: number; error?: string }
    setAddingToList(null)
    if (res.ok) {
      setAddToListMsg(`Added ${data.added ?? selected.size} contact${selected.size !== 1 ? 's' : ''} to list`)
    } else {
      setAddToListMsg(data.error ?? 'Failed')
    }
  }

  async function bulkAction(action: 'archive' | 'unarchive' | 'delete') {
    if (selected.size === 0) return
    setBulkLoading(true)
    try {
      await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      })
      await loadContacts()
    } finally {
      setBulkLoading(false)
      setDeleteConfirm(false)
    }
  }

  const selectedCount = selected.size

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
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

        <button
          onClick={() => { setShowArchived((v) => !v); setSelected(new Set()) }}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            showArchived
              ? 'bg-[#604484]/20 border-[#604484]/40 text-white'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          {showArchived ? 'Showing archived' : 'Show archived'}
        </button>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#604484]/15 border border-[#604484]/30 rounded-xl">
          <span className="text-xs text-white font-medium">{selectedCount} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={openAddToList}
              className="px-3 py-1.5 text-xs rounded-lg bg-cbba-purple/20 text-cbba-purple hover:bg-cbba-purple/30 border border-cbba-purple/30 transition-colors"
            >
              Add to list
            </button>
            {!showArchived ? (
              <button
                onClick={() => bulkAction('archive')}
                disabled={bulkLoading}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/10 text-gray-300 hover:text-white hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                Archive
              </button>
            ) : (
              <button
                onClick={() => bulkAction('unarchive')}
                disabled={bulkLoading}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/10 text-gray-300 hover:text-white hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                Unarchive
              </button>
            )}
            <button
              onClick={() => setDeleteConfirm(true)}
              disabled={bulkLoading}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
            >
              Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-cbba-navy-light border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-3.5 h-3.5 accent-[#604484] cursor-pointer"
                />
              </th>
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
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-white/5 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                  {search ? 'No contacts match your search.' : showArchived ? 'No archived contacts.' : 'No contacts yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((contact) => (
                <tr
                  key={contact.id}
                  className={`border-b border-white/5 last:border-0 transition-colors ${
                    selected.has(contact.id) ? 'bg-[#604484]/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(contact.id)}
                      onChange={() => toggleOne(contact.id)}
                      className="w-3.5 h-3.5 accent-[#604484] cursor-pointer"
                    />
                  </td>
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

      {/* Add to list modal */}
      {showAddToList && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cbba-navy-dark border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Add {selectedCount} contact{selectedCount !== 1 ? 's' : ''} to list</h3>
              <button onClick={() => { setShowAddToList(false); setAddToListMsg('') }} className="text-gray-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {addToListMsg ? (
              <p className="text-sm text-green-400">{addToListMsg}</p>
            ) : lists.length === 0 ? (
              <p className="text-sm text-gray-500">No lists yet. Create one in the Lists tab first.</p>
            ) : (
              <div className="space-y-1.5">
                {lists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => addToList(l.id)}
                    disabled={addingToList === l.id}
                    className="w-full text-left px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex items-center justify-between"
                  >
                    <span className="text-sm text-white">{l.name}</span>
                    {addingToList === l.id && (
                      <svg className="w-4 h-4 animate-spin text-cbba-purple" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => { setShowAddToList(false); setAddToListMsg('') }} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                {addToListMsg ? 'Done' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cbba-navy-light border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Delete {selectedCount} contact{selectedCount !== 1 ? 's' : ''}?</h3>
            <p className="text-sm text-gray-400">This permanently deletes the contact records. Their conversation history may also be removed.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={() => bulkAction('delete')}
                disabled={bulkLoading}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium disabled:opacity-50 hover:bg-red-500/30 transition-colors"
              >
                {bulkLoading ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
