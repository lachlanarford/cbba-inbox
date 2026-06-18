'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ChannelIcon from '@/components/ui/ChannelIcon'
import ContactModal from './ContactModal'
import ComposeModal from './ComposeModal'
import type { Contact } from '@/types/database'

interface ListMember extends Contact {
  added_at: string
}

interface ContactList {
  id: string
  name: string
  description: string | null
}

interface Props {
  list: ContactList
  onBack: () => void
  onDelete: () => void
}

export default function ContactListDetail({ list, onBack, onDelete }: Props) {
  const [members, setMembers] = useState<ListMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [removing, setRemoving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(list.name)
  const [savingName, setSavingName] = useState(false)

  const [composeContact, setComposeContact] = useState<ListMember | null>(null)
  const [showEmailAll, setShowEmailAll] = useState(false)

  // Add contact states
  const [showNewContact, setShowNewContact] = useState(false)
  const [showFindContact, setShowFindContact] = useState(false)
  const [findSearch, setFindSearch] = useState('')
  const [findResults, setFindResults] = useState<Contact[]>([])
  const [findLoading, setFindLoading] = useState(false)
  const [addingContact, setAddingContact] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/contacts/lists/${list.id}/members`)
    if (res.ok) {
      const data = await res.json() as { members: ListMember[] }
      setMembers(data.members)
    }
    setLoading(false)
  }, [list.id])

  useEffect(() => { loadMembers() }, [loadMembers])

  // Search existing contacts for "Find contact"
  useEffect(() => {
    if (!showFindContact) return
    if (!findSearch.trim()) { setFindResults([]); return }
    const timer = setTimeout(async () => {
      setFindLoading(true)
      const supabase = createClient()
      const term = `%${findSearch.trim().toLowerCase()}%`
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .or(`full_name.ilike.${term},email.ilike.${term}`)
        .filter('is_archived', 'eq', false)
        .limit(10)
      setFindResults((data ?? []) as Contact[])
      setFindLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [findSearch, showFindContact])

  async function addContactToList(contactId: string) {
    setAddingContact(contactId)
    await fetch(`/api/contacts/lists/${list.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_ids: [contactId] }),
    })
    setAddingContact(null)
    setShowFindContact(false)
    setFindSearch('')
    setFindResults([])
    await loadMembers()
  }

  const filtered = members.filter((m) => {
    if (!search) return true
    const t = search.toLowerCase()
    return m.full_name?.toLowerCase().includes(t) || m.email?.toLowerCase().includes(t)
  })

  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id))

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map((m) => m.id)))
  }

  async function removeSelected() {
    if (!selected.size) return
    setRemoving(true)
    await fetch(`/api/contacts/lists/${list.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_ids: Array.from(selected) }),
    })
    setSelected(new Set())
    await loadMembers()
    setRemoving(false)
  }

  async function saveName() {
    if (!nameInput.trim() || nameInput === list.name) { setEditingName(false); return }
    setSavingName(true)
    await fetch(`/api/contacts/lists/${list.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim() }),
    })
    list.name = nameInput.trim()
    setEditingName(false)
    setSavingName(false)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(list.name) } }}
                className="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-cbba-purple"
              />
              <button onClick={saveName} disabled={savingName} className="text-xs text-cbba-purple hover:text-cbba-purple-light">Save</button>
              <button onClick={() => { setEditingName(false); setNameInput(list.name) }} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white truncate">{list.name}</h2>
              <button onClick={() => setEditingName(true)} className="text-gray-600 hover:text-gray-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500">{members.length} contact{members.length !== 1 ? 's' : ''}</p>
        </div>

        <button
          onClick={onDelete}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1"
        >
          Delete list
        </button>
      </div>

      {/* Search + add bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cbba-purple transition-colors"
          />
        </div>

        <button
          onClick={() => setShowNewContact(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New contact
        </button>

        <button
          onClick={() => { setShowFindContact(true); setFindSearch(''); setFindResults([]) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          Find contact
        </button>

        {members.some((m) => m.email) && (
          <button
            onClick={() => setShowEmailAll(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-xs font-medium hover:text-cbba-purple hover:border-cbba-purple/40 transition-colors flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Email all
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#604484]/15 border border-[#604484]/30 rounded-xl">
          <span className="text-xs text-white font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={removeSelected}
              disabled={removing}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
            >
              {removing ? 'Removing...' : 'Remove from list'}
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
              {['Name', 'Email', 'Phone', 'Channel', 'Added', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                  {search ? 'No members match your search.' : 'No contacts in this list yet.'}
                </td>
              </tr>
            ) : (
              filtered.map((member) => (
                <tr
                  key={member.id}
                  className={`border-b border-white/5 last:border-0 transition-colors ${selected.has(member.id) ? 'bg-[#604484]/10' : 'hover:bg-white/5'}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(member.id)}
                      onChange={() => setSelected((prev) => { const n = new Set(prev); n.has(member.id) ? n.delete(member.id) : n.add(member.id); return n })}
                      className="w-3.5 h-3.5 accent-[#604484] cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${member.id}`} className="text-sm font-medium text-white hover:text-cbba-gold transition-colors">
                      {member.full_name ?? 'Unknown'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{member.email ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{member.phone ?? '-'}</td>
                  <td className="px-4 py-3">
                    {member.channel ? <ChannelIcon channel={member.channel} className="w-4 h-4" showLabel /> : <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(member.added_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {member.email && (
                      <button
                        onClick={() => setComposeContact(member)}
                        className="p-1 rounded text-gray-600 hover:text-cbba-purple hover:bg-white/5 transition-colors"
                        title="Send email"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New contact modal -- creates contact then adds to list */}
      {showNewContact && (
        <ContactModal
          mode="add"
          onClose={() => setShowNewContact(false)}
          onSaved={async (contact) => {
            setShowNewContact(false)
            await fetch(`/api/contacts/lists/${list.id}/members`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contact_ids: [contact.id] }),
            })
            await loadMembers()
          }}
        />
      )}

      {/* Individual compose modal */}
      {composeContact && (
        <ComposeModal
          to={composeContact.email ?? ''}
          contactId={composeContact.id}
          contactName={composeContact.full_name ?? undefined}
          onClose={() => setComposeContact(null)}
        />
      )}

      {/* Email all modal */}
      {showEmailAll && (
        <ComposeModal
          bccList={members.filter((m) => m.email).map((m) => m.email as string)}
          listName={list.name}
          onClose={() => setShowEmailAll(false)}
        />
      )}

      {/* Find contact modal */}
      {showFindContact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cbba-navy-dark border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Find contact</h2>
              <button
                onClick={() => { setShowFindContact(false); setFindSearch(''); setFindResults([]) }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                autoFocus
                type="text"
                value={findSearch}
                onChange={(e) => setFindSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple transition-colors"
              />
            </div>

            <div className="min-h-[80px]">
              {findLoading ? (
                <div className="flex items-center justify-center py-6">
                  <svg className="w-5 h-5 animate-spin text-cbba-purple" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : findSearch.trim() && findResults.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No contacts found.</p>
              ) : (
                <div className="space-y-1">
                  {findResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => addContactToList(c.id)}
                      disabled={addingContact === c.id}
                      className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex items-center justify-between gap-2 disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{c.full_name ?? 'Unknown'}</p>
                        {c.email && <p className="text-xs text-gray-500 truncate">{c.email}</p>}
                      </div>
                      {addingContact === c.id ? (
                        <svg className="w-4 h-4 animate-spin text-cbba-purple flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <span className="text-xs text-cbba-purple flex-shrink-0">Add</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => { setShowFindContact(false); setFindSearch(''); setFindResults([]) }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
