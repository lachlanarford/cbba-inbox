'use client'

import { useState, useTransition } from 'react'

interface ChatModeToggleProps {
  initialMode: string
}

export default function ChatModeToggle({ initialMode }: ChatModeToggleProps) {
  const [mode, setMode] = useState(initialMode)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = mode === 'ai' ? 'live' : 'ai'
    startTransition(async () => {
      await fetch('/api/settings/chat-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      })
      setMode(next)
    })
  }

  const isLive = mode === 'live'

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={isLive ? 'Switch to AI Chat' : 'Switch to Live Chat'}
      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
        isLive
          ? 'bg-green-500/15 text-green-400 border border-green-500/30'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {isLive ? (
        <span className="relative flex h-4 w-4 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
          </span>
        </span>
      ) : (
        <RobotIcon className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{isLive ? 'Live Chat' : 'AI Chat'}</span>
    </button>
  )
}

function RobotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.699-1.329 2.699H4.127c-1.36 0-2.333-1.699-1.329-2.699L4.2 15.3" />
    </svg>
  )
}
