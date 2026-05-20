'use client'

import { useState, useTransition } from 'react'

export default function BugReportForm() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

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
        {success && <p className="text-xs text-green-400">Issue submitted successfully. Thank you!</p>}

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-cbba-purple text-white text-sm font-medium disabled:opacity-50 hover:bg-cbba-purple-light transition-colors"
        >
          {isPending ? 'Submitting...' : 'Submit report'}
        </button>
      </div>
    </div>
  )
}
