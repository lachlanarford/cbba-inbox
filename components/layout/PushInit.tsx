'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAppUser } from '@/contexts/AppUserContext'
import {
  fetchPushStatus,
  isPushSupported,
  registerServiceWorker,
  subscribeToPush,
} from '@/lib/push/client'

const STORAGE_KEY = 'cbba-push-dismissed'

export default function PushInit() {
  const user = useAppUser()
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return

    void registerServiceWorker()

    async function init() {
      const status = await fetchPushStatus()
      if (status.pushEnabled && Notification.permission === 'granted') {
        await subscribeToPush().catch(() => {})
        return
      }

      if (Notification.permission === 'denied') return
      if (status.pushEnabled) return
      if (localStorage.getItem(STORAGE_KEY)) return

      setShowBanner(true)
    }

    void init()
  }, [user.id])

  function handleDismiss() {
    setShowBanner(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-cbba-navy-light border border-white/10 shadow-2xl text-sm max-w-md w-full mx-4">
      <svg className="w-5 h-5 flex-shrink-0 text-cbba-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span className="flex-1 text-gray-300 text-xs">Enable push notifications for new messages and assignments?</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/settings"
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light transition-colors"
        >
          Settings
        </Link>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
