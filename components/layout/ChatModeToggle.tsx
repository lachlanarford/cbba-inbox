'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const AUTO_OFF_MS = 30 * 60 * 1000   // 30 minutes
const WARN_AT_MS = 25 * 60 * 1000    // warn at 25 minutes (5 mins left)

interface Props {
  initialLive: boolean
}

export default function ChatModeToggle({ initialLive }: Props) {
  const [isLive, setIsLive] = useState(initialLive)
  const [isPending, setIsPending] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(5 * 60)

  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const offTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current) { clearTimeout(warnTimerRef.current); warnTimerRef.current = null }
    if (offTimerRef.current) { clearTimeout(offTimerRef.current); offTimerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    setShowWarning(false)
    setCountdown(5 * 60)
  }, [])

  const startTimers = useCallback(() => {
    clearTimers()
    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true)
      setCountdown(5 * 60)
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!)
            return 0
          }
          return c - 1
        })
      }, 1000)
    }, WARN_AT_MS)

    offTimerRef.current = setTimeout(() => {
      setShowWarning(false)
      setIsLive(false)
      fetch('/api/settings/chat-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'ai' }),
      }).catch(() => {})
    }, AUTO_OFF_MS)
  }, [clearTimers])

  useEffect(() => {
    if (isLive) startTimers()
    else clearTimers()
    return clearTimers
  }, [isLive, startTimers, clearTimers])

  async function toggle() {
    const next = !isLive
    setIsPending(true)
    try {
      await fetch('/api/settings/chat-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next ? 'live' : 'ai' }),
      })
      setIsLive(next)
    } finally {
      setIsPending(false)
    }
  }

  function stayActive() {
    setShowWarning(false)
    startTimers()
  }

  function formatCountdown(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <>
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

      {/* Are you still there? modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-cbba-navy-dark border border-white/10 rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-5 w-5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500 items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-white" />
                </span>
              </span>
              <h3 className="text-sm font-semibold text-white">Are you still there?</h3>
            </div>
            <p className="text-sm text-gray-400">
              You&apos;ve been in Live Chat mode for 25 minutes. It will automatically turn off in{' '}
              <span className="text-white font-medium">{formatCountdown(countdown)}</span>.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={stayActive}
                className="flex-1 px-4 py-2 rounded-lg bg-cbba-purple text-white text-sm font-medium hover:bg-cbba-purple-light transition-colors"
              >
                Stay active
              </button>
              <button
                onClick={() => { setShowWarning(false); setIsLive(false); clearTimers(); fetch('/api/settings/chat-mode', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'ai' }) }).catch(() => {}) }}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-gray-300 text-sm font-medium hover:text-white transition-colors"
              >
                Turn off
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function RobotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.699-1.329 2.699H4.127c-1.36 0-2.333-1.699-1.329-2.699L4.2 15.3" />
    </svg>
  )
}
