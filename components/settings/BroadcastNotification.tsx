'use client'

import { useState } from 'react'

export default function BroadcastNotification() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [count, setCount] = useState(0)

  async function send() {
    setStatus('sending')
    try {
      const res = await fetch('/api/admin/broadcast', { method: 'POST' })
      const data = await res.json() as { sent?: number; error?: string }
      if (res.ok) {
        setCount(data.sent ?? 0)
        setStatus('sent')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">Send changelog notification</p>
        <p className="text-xs text-gray-500 mt-1">
          Pushes a &quot;What&apos;s new&quot; notification to all staff. They can tap it to view the full changelog.
        </p>
        {status === 'sent' && (
          <p className="text-xs text-green-400 mt-2">Sent to {count} staff member{count !== 1 ? 's' : ''}</p>
        )}
        {status === 'error' && (
          <p className="text-xs text-red-400 mt-2">Failed to send. Try again.</p>
        )}
      </div>
      <button
        onClick={send}
        disabled={status === 'sending' || status === 'sent'}
        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending...
          </>
        ) : status === 'sent' ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Sent
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Send now
          </>
        )}
      </button>
    </div>
  )
}
