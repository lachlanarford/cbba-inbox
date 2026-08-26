'use client'

import { useState } from 'react'
import DriveSync from './DriveSync'

interface KnowledgeManagerProps {
  driveFolderId: string
  driveChannelConfigId: string
  gmailAccounts: { id: string; email: string }[]
}

export default function KnowledgeManager({ driveFolderId, driveChannelConfigId, gmailAccounts }: KnowledgeManagerProps) {
  return (
    <div className="space-y-6">
      <WebsiteFaqs />
      <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-6">
        <DriveSync
          initialFolderId={driveFolderId}
          initialChannelConfigId={driveChannelConfigId}
          gmailAccounts={gmailAccounts}
        />
      </div>
    </div>
  )
}

function WebsiteFaqs() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function refreshFaqs() {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/knowledge/seed', { method: 'POST' })
      const data = await res.json() as { inserted?: number; updated?: number; error?: string }
      if (!res.ok) {
        setMessage(data.error ?? 'Could not refresh FAQs')
        return
      }
      const inserted = data.inserted ?? 0
      const updated = data.updated ?? 0
      setMessage(`Website FAQs refreshed. ${updated} updated, ${inserted} added.`)
    } catch {
      setMessage('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">Website FAQs</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Curated answers for membership, Aussie Hoops, Assist All Hoops, domestic comps, Prep4Reps, and referees. The website chatbot prefers these over long policy PDFs.
          </p>
        </div>
        <button
          onClick={refreshFaqs}
          disabled={busy}
          className="shrink-0 px-4 py-2 bg-cbba-purple hover:bg-cbba-purple-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {busy ? 'Refreshing...' : 'Refresh FAQs'}
        </button>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${message.startsWith('Website') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
