'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cbba-push-dismissed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function subscribeToPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '') as unknown as BufferSource,
    })
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    return true
  } catch {
    return false
  }
}

export default function PushInit() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // Register service worker
    navigator.serviceWorker.register('/sw.js').catch(() => {})

    // If already granted, subscribe silently
    if (Notification.permission === 'granted') {
      subscribeToPush().catch(() => {})
      return
    }

    // If denied, do nothing
    if (Notification.permission === 'denied') return

    // Show banner unless previously dismissed
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShowBanner(true)
    }
  }, [])

  async function handleEnable() {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      await subscribeToPush()
    }
    setShowBanner(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  function handleDismiss() {
    setShowBanner(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-cbba-navy-light border border-white/10 shadow-2xl text-sm max-w-sm w-full mx-4">
      <svg className="w-5 h-5 flex-shrink-0 text-cbba-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span className="flex-1 text-gray-300">Enable desktop notifications for new messages?</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleEnable}
          className="px-3 py-1.5 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light transition-colors"
        >
          Enable
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
