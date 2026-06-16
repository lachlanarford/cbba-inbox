'use client'

import { useState } from 'react'

interface SyncResult {
  name: string
  status: 'synced' | 'skipped' | 'error'
}

interface Props {
  initialFolderId: string
  initialHasServiceAccount: boolean
}

export default function DriveSync({ initialFolderId, initialHasServiceAccount }: Props) {
  const [folderId, setFolderId] = useState(initialFolderId)
  const [serviceAccountJson, setServiceAccountJson] = useState('')
  const [hasServiceAccount, setHasServiceAccount] = useState(initialHasServiceAccount)
  const [savingFolder, setSavingFolder] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null)
  const [syncError, setSyncError] = useState('')

  async function saveSetting(key: string, value: string, setLoading: (v: boolean) => void) {
    setLoading(true)
    setSavedMsg('')
    try {
      const res = await fetch('/api/settings/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setSavedMsg(`Error: ${d.error ?? 'Failed to save'}`)
      } else {
        setSavedMsg('Saved.')
        if (key === 'drive_service_account') {
          setHasServiceAccount(true)
          setServiceAccountJson('')
        }
      }
    } finally {
      setLoading(false)
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
          <li>Create a <strong className="text-gray-300">Service Account</strong> in Google Cloud Console and download its JSON key</li>
          <li>Share your Drive knowledge folder with the service account email (Viewer access)</li>
          <li>Paste the folder ID below (from the folder URL: <code className="text-gray-300">drive.google.com/drive/folders/THIS_PART</code>)</li>
          <li>Paste the JSON key and save, then click Sync</li>
        </ol>
        <p className="text-xs text-gray-500 pt-1">Supported file types: Google Docs, Google Sheets, PDF files. Other types are skipped.</p>
      </div>

      {/* Folder ID */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Drive Folder ID</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple"
          />
          <button
            onClick={() => saveSetting('drive_folder_id', folderId, setSavingFolder)}
            disabled={savingFolder || !folderId.trim()}
            className="px-4 py-2 bg-cbba-purple hover:bg-cbba-purple-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {savingFolder ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Service Account JSON */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Service Account JSON Key
          {hasServiceAccount && (
            <span className="ml-2 text-xs text-green-400 font-normal">Configured</span>
          )}
        </label>
        <textarea
          value={serviceAccountJson}
          onChange={(e) => setServiceAccountJson(e.target.value)}
          placeholder={hasServiceAccount ? 'Paste a new JSON key to replace the existing one' : 'Paste the contents of your service account JSON key file here'}
          rows={6}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple font-mono"
        />
        <button
          onClick={() => saveSetting('drive_service_account', serviceAccountJson, setSavingAccount)}
          disabled={savingAccount || !serviceAccountJson.trim()}
          className="mt-2 px-4 py-2 bg-cbba-purple hover:bg-cbba-purple-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {savingAccount ? 'Saving...' : 'Save Service Account'}
        </button>
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
            <p className="text-xs text-gray-500 mt-0.5">Pulls all supported files from your folder and adds them to the knowledge base</p>
          </div>
          <button
            onClick={runSync}
            disabled={syncing || !hasServiceAccount || !folderId.trim()}
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
