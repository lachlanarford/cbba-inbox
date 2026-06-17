'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ChannelIcon from '@/components/ui/ChannelIcon'
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

      {/* Search + bulk bar */}
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
              {['Name', 'Email', 'Phone', 'Channel', 'Added'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
