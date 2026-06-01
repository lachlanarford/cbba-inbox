'use client'

import { useState, useTransition, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppUser } from '@/contexts/AppUserContext'

interface BugReport {
  id: string
  title: string
  description: string
  status: 'open' | 'in_progress' | 'resolved'
  priority: 'low' | 'medium' | 'high'
  created_at: string
}

const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' }
const STATUS_CLASSES = {
  open: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  resolved: 'bg-green-500/15 text-green-400 border-green-500/20',
}

export default function BugReportForm() {
  const user = useAppUser()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [myReports, setMyReports] = useState<BugReport[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/bug-reports')
      .then((r) => r.json())
      .then((d: BugReport[]) => setMyReports(d))
      .catch(() => {})

    // Realtime: watch for status changes on my own submissions
    const supabase = createClient()
    const channel = supabase
      .channel('my-bug-reports')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bug_reports', filter: `submitted_by=eq.${user.id}` },
        (payload) => {
          setMyReports((prev) =>
            prev.map((r) => r.id === (payload.new as BugReport).id ? { ...r, ...(payload.new as BugReport) } : r)
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  function handleSubmit() {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), priority }),
      })
      if (res.ok) {
        const newReport = await res.json() as BugReport
        setMyReports((prev) => [newReport, ...prev])
        setTitle('')
        setDescription('')
        setPriority('medium')
        setSuccess(true)
        setTimeout(() => setSuccess(false), 4000)
      } else {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Failed to submit')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Submit form */}
      <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-6 max-w-lg">
        <h2 className="text-sm font-semibold text-white mb-1">Report an issue</h2>
        <p className="text-xs text-gray-500 mb-5">Found a bug or have a feature request? Let us know.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Steps to reproduce, what you expected, what actually happened..."
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cbba-purple transition-colors"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {success && <p className="text-xs text-green-400">Issue submitted — we will look into it.</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-cbba-purple text-white text-sm font-medium disabled:opacity-50 hover:bg-cbba-purple-light transition-colors"
          >
            {isPending ? 'Submitting...' : 'Submit report'}
          </button>
        </div>
      </div>

      {/* My submissions */}
      {myReports.length > 0 && (
        <div className="max-w-lg">
          <h3 className="text-sm font-semibold text-white mb-3">Your submissions</h3>
          <div className="space-y-2">
            {myReports.map((r) => (
              <div key={r.id} className="bg-cbba-navy-dark border border-white/10 rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{r.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_CLASSES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded === r.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {expanded === r.id && (
                  <div className="px-4 pb-4 border-t border-white/5">
                    <p className="text-xs text-gray-400 mt-3 whitespace-pre-wrap leading-relaxed">{r.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
