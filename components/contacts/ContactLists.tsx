'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDate } from '@/lib/utils/time'
import ContactListDetail from './ContactListDetail'

interface ContactList {
  id: string
  name: string
  description: string | null
  created_at: string
  member_count: number
}

export default function ContactLists() {
  const [lists, setLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [activeList, setActiveList] = useState<ContactList | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadLists = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/contacts/lists')
    if (res.ok) {
      const data = await res.json() as { lists: ContactList[] }
      setLists(data.lists)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadLists() }, [loadLists])

  async function createList() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/contacts/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
    })
    if (res.ok) {
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      await loadLists()
    }
    setCreating(false)
  }

  async function deleteList(id: string) {
    setDeleting(true)
    await fetch(`/api/contacts/lists/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteId(null)
    if (activeList?.id === id) setActiveList(null)
    await loadLists()
  }

  if (activeList) {
    return (
      <ContactListDetail
        list={activeList}
        onBack={() => { setActiveList(null); loadLists() }}
        onDelete={() => setDeleteId(activeList.id)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{lists.length} list{lists.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-cbba-purple hover:bg-cbba-purple-dark text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New list
        </button>
      </div>

      {/* Lists grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-cbba-navy-light border border-white/5 rounded-xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="bg-cbba-navy-light border border-white/5 rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No contact lists yet.</p>
          <p className="text-xs text-gray-600 mt-1">Create a list to group contacts for easy reference.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lists.map((list) => (
            <div
              key={list.id}
              onClick={() => setActiveList(list)}
              className="group bg-cbba-navy-light border border-white/5 hover:border-white/10 rounded-xl p-5 cursor-pointer transition-colors relative"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteId(list.id) }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg bg-cbba-purple/15 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-cbba-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{list.name}</p>
                  <p className="text-xs text-gray-500">{list.member_count} contact{list.member_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
              {list.description && (
                <p className="text-xs text-gray-500 truncate mt-1">{list.description}</p>
              )}
              <p className="text-[10px] text-gray-600 mt-2">Created {formatDate(list.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cbba-navy-dark border border-white/10 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">New contact list</h3>
              <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc('') }} className="text-gray-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">List name</label>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createList()}
                placeholder="e.g. Newsletter subscribers"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What's this list for?"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc('') }} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={createList}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-lg bg-cbba-purple text-white text-sm font-medium disabled:opacity-50 hover:bg-cbba-purple-dark transition-colors"
              >
                {creating ? 'Creating...' : 'Create list'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cbba-navy-dark border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Delete list?</h3>
            <p className="text-sm text-gray-400">The list and all its memberships will be removed. The contacts themselves are not deleted.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button
                onClick={() => deleteList(deleteId)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium disabled:opacity-50 hover:bg-red-500/30 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
