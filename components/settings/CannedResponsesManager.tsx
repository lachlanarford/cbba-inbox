'use client'

import { useState, useEffect, useTransition } from 'react'

interface CannedResponse {
  id: string
  title: string
  content: string
  created_at: string
}

export default function CannedResponsesManager() {
  const [items, setItems] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CannedResponse | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch('/api/canned-responses')
      .then((r) => r.json())
      .then((d: CannedResponse[]) => { setItems(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function openNew() {
    setEditing(null)
    setTitle('')
    setContent('')
    setError(null)
    setShowForm(true)
  }

  function openEdit(item: CannedResponse) {
    setEditing(item)
    setTitle(item.title)
    setContent(item.content)
    setError(null)
    setShowForm(true)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const url = editing ? `/api/canned-responses/${editing.id}` : '/api/canned-responses'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      const json = await res.json() as CannedResponse & { error?: string }
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }

      if (editing) {
        setItems((prev) => prev.map((i) => (i.id === editing.id ? json : i)))
      } else {
        setItems((prev) => [...prev, json].sort((a, b) => a.title.localeCompare(b.title)))
      }
      setShowForm(false)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await fetch(`/api/canned-responses/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((i) => i.id !== id))
    })
  }

  if (loading) return <div className="text-xs text-gray-500 p-6">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-white">Canned Responses</h2>
          <p className="text-xs text-gray-500 mt-0.5">Saved reply templates for the whole team</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New template
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 border border-white/5 rounded-xl">
          <p className="text-sm text-gray-500">No templates yet.</p>
          <button onClick={openNew} className="mt-2 text-xs text-cbba-purple hover:underline">Create your first one</button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-cbba-navy-light border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">{item.content}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-cbba-navy-light border border-white/10 rounded-xl w-full max-w-lg mx-4 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-4">
              {editing ? 'Edit template' : 'New template'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Registration confirmation"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Content *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type your template message here..."
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-y focus:outline-none focus:border-cbba-purple transition-colors"
                />
              </div>
              {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !title.trim() || !content.trim()}
                className="flex-1 px-3 py-2 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving...' : 'Save template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
