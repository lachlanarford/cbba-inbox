'use client'

import { useState, useEffect, useCallback } from 'react'

interface SyncResult {
  name: string
  status: 'synced' | 'skipped' | 'error'
}

interface SyncLog {
  id: string
  created_at: string
  trigger: string
  synced_count: number
  skipped_count: number
  error_count: number
  status: string
  error_message: string | null
}

interface Props {
  initialFolderId: string
  initialChannelConfigId: string
  gmailAccounts: { id: string; email: string }[]
}

export default function DriveSync({ initialFolderId, initialChannelConfigId, gmailAccounts }: Props) {
  const [folderId, setFolderId] = useState(initialFolderId)
  const [channelConfigId, setChannelConfigId] = useState(initialChannelConfigId)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null)
  const [syncError, setSyncError] = useState('')
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/sync-logs')
      if (res.ok) {
        const data = await res.json() as { logs: SyncLog[] }
        setLogs(data.logs)
      }
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  function extractFolderId(input: string): string {
    const match = input.match(/\/folders\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : input.trim()
  }

  async function saveSetting(key: string, value: string) {
    const res = await fetch('/api/settings/drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    return res.ok
  }

  async function saveFolder() {
    setSaving(true)
    setSavedMsg('')
    const id = extractFolderId(folderId)
    if (id !== folderId) setFolderId(id)
    try {
      const [folderOk, accountOk] = await Promise.all([
        saveSetting('drive_folder_id', id),
        channelConfigId ? saveSetting('drive_channel_config_id', channelConfigId) : Promise.resolve(true),
      ])
      setSavedMsg(folderOk && accountOk ? 'Saved.' : 'Error: Failed to save')
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
        await fetchLogs()
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
          <li>Choose the Google account that has access to your Drive folder below</li>
          <li>Create a folder in Google Drive and add your policy docs, Google Docs, or Sheets</li>
          <li>Paste the folder ID and save -- the AI will use these documents when answering questions</li>
        </ol>
        <p className="text-xs text-gray-500 pt-1">Supported: Google Docs, Google Sheets, PDF files. Syncs automatically every hour.</p>
      </div>

      {/* Google account picker */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Google Account</label>
        <p className="text-xs text-gray-500 mb-2">Choose the account that has access to your Drive folder.</p>
        <select
          value={channelConfigId}
          onChange={(e) => setChannelConfigId(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cbba-purple"
        >
          <option value="">Select an account...</option>
          {gmailAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.email}</option>
          ))}
        </select>
      </div>

      {/* Folder ID */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Drive Folder ID</label>
        <p className="text-xs text-gray-500 mb-2">
          Paste the full folder URL or just the ID -- both work.
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

      {/* Manual sync */}
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

      {/* Sync log */}
      <div className="border-t border-white/10 pt-6">
        <p className="text-sm font-medium text-white mb-3">Sync history</p>
        {logsLoading ? (
          <p className="text-xs text-gray-600">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-xs text-gray-600">No syncs yet.</p>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-500">
                  <th className="px-4 py-2.5 text-left font-medium">Time</th>
                  <th className="px-4 py-2.5 text-left font-medium">Trigger</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Documents</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-gray-400">{formatRelative(log.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {log.trigger === 'manual' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#604484]/20 text-[#a78bfa]">Manual</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-400">Auto</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {log.status === 'success' && <span className="flex items-center gap-1 text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Success</span>}
                      {log.status === 'partial' && <span className="flex items-center gap-1 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Partial</span>}
                      {log.status === 'error' && <span className="flex items-center gap-1 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Error</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">
                      <span className="text-white">{log.synced_count}</span> synced
                      {log.skipped_count > 0 && <span className="text-gray-600">, {log.skipped_count} skipped</span>}
                      {log.error_count > 0 && <span className="text-red-400">, {log.error_count} errors</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
