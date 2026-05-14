'use client'

import { useState, useTransition } from 'react'
import type { KnowledgeBaseEntry } from '@/types/database'

interface KnowledgeManagerProps {
  initialEntries: KnowledgeBaseEntry[]
}

interface ManualEntryForm {
  title: string
  content: string
}

export default function KnowledgeManager({ initialEntries }: KnowledgeManagerProps) {
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>(initialEntries)
  const [urlInput, setUrlInput] = useState('')
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [scrapeSuccess, setScrapeSuccess] = useState<string | null>(null)
  const [isScraping, startScrape] = useTransition()
  const [isRescraping, startRescrape] = useTransition()
  const [rescrapeResult, setRescrapeResult] = useState<string | null>(null)
  const [showManualModal, setShowManualModal] = useState(false)
  const [editEntry, setEditEntry] = useState<KnowledgeBaseEntry | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()
  const [manualForm, setManualForm] = useState<ManualEntryForm>({ title: '', content: '' })
  const [manualError, setManualError] = useState<string | null>(null)
  const [isSavingManual, startSaveManual] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function openAddManual() {
    setManualForm({ title: '', content: '' })
    setManualError(null)
    setEditEntry(null)
    setShowManualModal(true)
  }

  function openEditEntry(entry: KnowledgeBaseEntry) {
    setManualForm({ title: entry.title, content: entry.content })
    setManualError(null)
    setEditEntry(entry)
    setShowManualModal(true)
  }

  function handleScrape() {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    setScrapeError(null)
    setScrapeSuccess(null)
    startScrape(async () => {
      try {
        const res = await fetch('/api/knowledge/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        })
        const data = await res.json()
        if (!res.ok) {
          setScrapeError(data.error ?? 'Scrape failed')
          return
        }
        setScrapeSuccess(`Saved ${data.chunks_saved} chunks from "${data.title}"`)
        setUrlInput('')
        await refreshEntries()
      } catch {
        setScrapeError('Network error')
      }
    })
  }

  function handleRescrapeAll() {
    setRescrapeResult(null)
    startRescrape(async () => {
      try {
        const res = await fetch('/api/knowledge/rescrape-all', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          setRescrapeResult(`Error: ${data.error ?? 'Failed'}`)
          return
        }
        const failMsg = data.failed?.length ? ` (${data.failed.length} failed)` : ''
        setRescrapeResult(`Updated ${data.updated} URL entries${failMsg}`)
        await refreshEntries()
      } catch {
        setRescrapeResult('Network error')
      }
    })
  }

  async function refreshEntries() {
    const res = await fetch('/api/knowledge/entries')
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries)
    }
  }

  function handleSaveManual() {
    if (!manualForm.title.trim() || !manualForm.content.trim()) {
      setManualError('Title and content are required')
      return
    }
    setManualError(null)
    startSaveManual(async () => {
      try {
        const url = editEntry ? `/api/knowledge/entries/${editEntry.id}` : '/api/knowledge/entries'
        const method = editEntry ? 'PATCH' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: manualForm.title.trim(), content: manualForm.content.trim() }),
        })
        const data = await res.json()
        if (!res.ok) {
          setManualError(data.error ?? 'Save failed')
          return
        }
        setShowManualModal(false)
        await refreshEntries()
      } catch {
        setManualError('Network error')
      }
    })
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      try {
        const res = await fetch(`/api/knowledge/entries/${id}`, { method: 'DELETE' })
        if (res.ok) {
          setDeleteId(null)
          setEntries((prev) => prev.filter((e) => e.id !== id))
        }
      } catch {
        // silent
      }
    })
  }

  async function handleToggleActive(entry: KnowledgeBaseEntry) {
    setTogglingId(entry.id)
    try {
      const res = await fetch(`/api/knowledge/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !entry.is_active }),
      })
      if (res.ok) {
        setEntries((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, is_active: !e.is_active } : e))
        )
      }
    } finally {
      setTogglingId(null)
    }
  }

  const urlEntries = entries.filter((e) => e.source_type === 'url')
  const manualEntries = entries.filter((e) => e.source_type === 'manual')

  return (
    <div className="space-y-8">
      {/* Scrape URL */}
      <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Scrape a URL</h2>
        <div className="flex gap-3">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
            placeholder="https://example.com/page"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple"
          />
          <button
            onClick={handleScrape}
            disabled={isScraping || !urlInput.trim()}
            className="px-4 py-2 rounded-lg bg-cbba-purple text-white text-sm font-medium disabled:opacity-50 hover:bg-cbba-purple/80 transition-colors"
          >
            {isScraping ? 'Scraping...' : 'Scrape'}
          </button>
        </div>
        {scrapeError && <p className="mt-2 text-xs text-red-400">{scrapeError}</p>}
        {scrapeSuccess && <p className="mt-2 text-xs text-green-400">{scrapeSuccess}</p>}
      </div>

      {/* URL entries */}
      {urlEntries.length > 0 && (
        <div className="bg-cbba-navy-dark border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white">Scraped URLs ({urlEntries.length})</h2>
            <button
              onClick={handleRescrapeAll}
              disabled={isRescraping}
              className="text-xs text-cbba-purple hover:text-cbba-purple/80 transition-colors disabled:opacity-50"
            >
              {isRescraping ? 'Rescraping...' : 'Rescrape all'}
            </button>
          </div>
          {rescrapeResult && (
            <p className="px-6 py-2 text-xs text-gray-400 border-b border-white/10">{rescrapeResult}</p>
          )}
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">URL</th>
                <th className="px-6 py-3 font-medium">Last scraped</th>
                <th className="px-6 py-3 font-medium">Active</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {urlEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5 last:border-0">
                  <td className="px-6 py-3 text-sm text-white max-w-[200px] truncate">{entry.title}</td>
                  <td className="px-6 py-3 text-xs text-gray-400 max-w-[220px] truncate">
                    <a href={entry.source_url ?? ''} target="_blank" rel="noopener noreferrer" className="hover:text-cbba-purple transition-colors">
                      {entry.source_url}
                    </a>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500">
                    {entry.last_scraped_at ? new Date(entry.last_scraped_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleToggleActive(entry)}
                      disabled={togglingId === entry.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${entry.is_active ? 'bg-cbba-purple' : 'bg-white/10'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${entry.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => setDeleteId(entry.id)}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual entries */}
      <div className="bg-cbba-navy-dark border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">
            Manual entries {manualEntries.length > 0 && `(${manualEntries.length})`}
          </h2>
          <button
            onClick={openAddManual}
            className="text-xs text-cbba-purple hover:text-cbba-purple/80 transition-colors"
          >
            + Add entry
          </button>
        </div>
        {manualEntries.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-600 text-center">No manual entries yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Preview</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Active</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {manualEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5 last:border-0">
                  <td className="px-6 py-3 text-sm text-white max-w-[200px] truncate">{entry.title}</td>
                  <td className="px-6 py-3 text-xs text-gray-400 max-w-[260px] truncate">{entry.content}</td>
                  <td className="px-6 py-3 text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleToggleActive(entry)}
                      disabled={togglingId === entry.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${entry.is_active ? 'bg-cbba-purple' : 'bg-white/10'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${entry.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right space-x-3">
                    <button
                      onClick={() => openEditEntry(entry)}
                      className="text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteId(entry.id)}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual entry modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cbba-navy-dark border border-white/10 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">
                {editEntry ? 'Edit entry' : 'Add manual entry'}
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-gray-500 hover:text-white">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Title</label>
                <input
                  type="text"
                  value={manualForm.title}
                  onChange={(e) => setManualForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Refund policy"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Content</label>
                <textarea
                  value={manualForm.content}
                  onChange={(e) => setManualForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Write the knowledge content here..."
                  rows={8}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple resize-none"
                />
              </div>
              {manualError && <p className="text-xs text-red-400">{manualError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveManual}
                disabled={isSavingManual}
                className="px-4 py-2 rounded-lg bg-cbba-purple text-white text-sm font-medium disabled:opacity-50 hover:bg-cbba-purple/80 transition-colors"
              >
                {isSavingManual ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cbba-navy-dark border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Delete entry?</h3>
            <p className="text-sm text-gray-400">This will permanently remove this entry from the knowledge base.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium disabled:opacity-50 hover:bg-red-500/30 transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
