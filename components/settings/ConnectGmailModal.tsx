'use client'

import { useState } from 'react'

const CBBA_INBOXES = [
  { email: 'info@blacktownbasketball.com', label: 'info@ (General)' },
  { email: 'competitions@blacktownbasketball.com', label: 'competitions@ (Comps)' },
  { email: 'reps@blacktownbasketball.com', label: 'reps@ (Reps)' },
  { email: 'learntoplay@blacktownbasketball.com', label: 'learntoplay@ (Learn to Play)' },
  { email: 'referees@blacktownbasketball.com', label: 'referees@ (Referees)' },
]

interface ConnectGmailModalProps {
  onClose: () => void
}

export default function ConnectGmailModal({ onClose }: ConnectGmailModalProps) {
  const [email, setEmail] = useState('')
  const [connecting, setConnecting] = useState(false)

  function handleConnect() {
    if (!email) return
    setConnecting(true)
    // Redirect to OAuth flow -- page will leave and return to /settings/channels
    window.location.href = `/api/gmail/auth/start?email=${encodeURIComponent(email)}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-cbba-navy-light border border-white/10 rounded-2xl shadow-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Connect Gmail Inbox</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Select a CBBA inbox to connect or type a custom address. You will be redirected to Google to authorise access.
        </p>

        <div className="space-y-2 mb-4">
          {CBBA_INBOXES.map((inbox) => (
            <button
              key={inbox.email}
              onClick={() => setEmail(inbox.email)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${
                email === inbox.email
                  ? 'bg-cbba-purple/20 border-cbba-purple text-white'
                  : 'bg-white/4 border-white/8 text-gray-300 hover:bg-white/8 hover:text-white'
              }`}
            >
              {inbox.label}
              <span className="block text-xs text-gray-500 mt-0.5">{inbox.email}</span>
            </button>
          ))}
        </div>

        <div className="mb-5">
          <label className="text-xs text-gray-400 block mb-1.5">Or enter a custom email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="other@blacktownbasketball.com"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={!email || connecting}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-cbba-purple hover:bg-cbba-purple-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? 'Redirecting...' : 'Connect with Google'}
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-4">
          After connecting, the inbox will be inactive. Toggle it active once you have verified the connection.
        </p>
      </div>
    </div>
  )
}
