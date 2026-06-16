'use client'

import { useState } from 'react'

interface SyncResult {
  name: string
  status: 'synced' | 'skipped' | 'error'
}

interface Props {
  initialFolderId: string
}

export default function DriveSync({ initialFolderId }: Props) {
  const [folderId, setFolderId] = useState(initialFolderId)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null)
  const [syncError, setSyncError] = useState('')

  function extractFolderId(input: string): string {
    // Accept full URL like https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
    const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : input.trim()
  }

  async function saveFolder() {
    setSaving(true)
    setSavedMsg('')
    const id = extractFolderId(folderId)
    if (id !== folderId) setFolderId(id)
    try {
      const res = await fetch('/api/settings/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'drive_folder_id', value: id }),
      })
      const d = await res.json() as { error?: string }
      setSavedMsg(res.ok ? 'Saved.' : `Error: ${d.error ?? 'Failed'}`)
    } finally {
      setSaving(false)
    }
  }

  async function runSync() {
    setSyncing(true)
    setSyncResults(null)
    setSyncError('')
    try {
      const res = await fetch('/api/knowledge/drive-sync', { method: 'POST' })
      const data = await res.json() as { synced?: number; results?: SyncResult[]; error?: string }
      if (!res.ok) {
        setSyncError(data.error ?? 'Sync failed')
      } else {
        setSyncResults(data.results ?? [])
      }
    } catch {
      setSyncError('Network error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* How it works */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-2 text-sm text-gray-400">
        <p className="text-white font-medium">How Google Drive sync works</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Re-authorise your Gmail channel below to grant Drive access (one-time step)</li>
          <li>Create a folder in Google Drive and add your policy docs, Google Docs, or Sheets</li>
          <li>Paste the folder ID and click Sync — the AI will use these documents when answering questions</li>
        </ol>
        <p className="text-xs text-gray-500 pt-1">Supported: Google Docs, Google Sheets, PDF files. The folder must be accessible by the Gmail account connected to this inbox.</p>
      </div>

      {/* Re-authorise Gmail notice */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p className="text-sm text-amber-300 font-medium">Re-authorise required</p>
          <p className="text-xs text-amber-400/80 mt-0.5">Drive access was added to the Gmail connection. Go to <strong>Settings → Channels → Gmail</strong> and click Reconnect to grant Drive access, then come back here to sync.</p>
        </div>
      </div>

      {/* Folder ID */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Drive Folder ID</label>
        <p className="text-xs text-gray-500 mb-2">
          Paste the full folder URL or just the ID — both work.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple"
          />
          <button
            onClick={saveFolder}
            disabled={saving || !folderId.trim()}
            className="px-4 py-2 bg-cbba-purple hover:bg-cbba-purple-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {savedMsg && (
          <p className={`mt-2 text-sm ${savedMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
            {savedMsg}
          </p>
        )}
      </div>

      {/* Sync */}
      <div className="border-t border-white/10 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-white">Sync from Drive</p>
            <p className="text-xs text-gray-500 mt-0.5">Pulls all supported files from your folder and updates the knowledge base</p>
          </div>
          <button
            onClick={runSync}
            disabled={syncing || !folderId.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-cbba-purple hover:bg-cbba-purple-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        </div>

        {syncError && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{syncError}</p>
        )}

        {syncResults && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 mb-2">
              {syncResults.filter((r) => r.status === 'synced').length} synced
              {syncResults.filter((r) => r.status === 'skipped').length > 0 && `, ${syncResults.filter((r) => r.status === 'skipped').length} skipped`}
              {syncResults.filter((r) => r.status === 'error').length > 0 && `, ${syncResults.filter((r) => r.status === 'error').length} errors`}
            </p>
            {syncResults.map((result, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1">
                {result.status === 'synced' && <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />}
                {result.status === 'skipped' && <span className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" />}
                {result.status === 'error' && <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />}
                <span className={result.status === 'error' ? 'text-red-400' : result.status === 'skipped' ? 'text-gray-500' : 'text-gray-300'}>
                  {result.name}
                </span>
                {result.status === 'skipped' && <span className="text-xs text-gray-600">(empty)</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
