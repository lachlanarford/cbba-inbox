'use client'

import { useEffect, useState } from 'react'
import {
  disablePushNotifications,
  enablePushNotifications,
  fetchPushStatus,
  isPushSupported,
  registerServiceWorker,
  subscribeToPush,
} from '@/lib/push/client'
import { useAppUser } from '@/contexts/AppUserContext'

export default function NotificationSettings() {
  const user = useAppUser()
  const initialEnabled = (user.settings as Record<string, unknown>)?.push_enabled === true

  const [supported] = useState(isPushSupported())
  const [pushEnabled, setPushEnabled] = useState(initialEnabled)
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!supported) {
        setLoading(false)
        setPermission('unsupported')
        return
      }

      setPermission(Notification.permission)
      await registerServiceWorker()

      const status = await fetchPushStatus()
      setPushEnabled(status.pushEnabled)
      setSubscribed(status.subscribed)

      // Re-subscribe if enabled but subscription expired
      if (status.pushEnabled && Notification.permission === 'granted') {
        const sub = await subscribeToPush()
        if (sub) setSubscribed(true)
      }

      setLoading(false)
    }
    void load()
  }, [supported])

  async function handleToggle() {
    setError(null)
    setSuccess(null)
    setToggling(true)

    try {
      if (pushEnabled) {
        await disablePushNotifications()
        setPushEnabled(false)
        setSubscribed(false)
        setSuccess('Push notifications turned off.')
      } else {
        const result = await enablePushNotifications()
        if (!result.ok) {
          setError(result.error ?? 'Failed to enable push notifications')
          setPermission(Notification.permission)
          return
        }
        setPushEnabled(true)
        setSubscribed(true)
        setPermission('granted')
        setSuccess('Push notifications enabled.')
      }
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Notifications</h3>
        <p className="text-xs text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!supported) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Notifications</h3>
        <p className="text-xs text-gray-500">
          Push notifications are not supported in this browser. On iPhone, install the app to your home screen first.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-white mb-1">Push notifications</h3>
      <p className="text-xs text-gray-500 mb-3">
        Get notified when conversations are assigned to you, new messages arrive, or a live chat starts.
      </p>

      <div className="flex items-center justify-between gap-4 max-w-sm p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="min-w-0">
          <p className="text-sm text-white">Desktop notifications</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {permission === 'denied'
              ? 'Blocked in browser settings'
              : pushEnabled && subscribed
                ? 'Enabled on this device'
                : pushEnabled
                  ? 'Enabled, but not subscribed on this device'
                  : 'Off'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={pushEnabled}
          disabled={toggling || permission === 'denied'}
          onClick={() => { void handleToggle() }}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-150 ease-out disabled:opacity-40 ${
            pushEnabled ? 'bg-cbba-purple' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ease-out ${
              pushEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {permission === 'denied' && (
        <p className="text-xs text-amber-400/90 mt-2 max-w-sm">
          Notifications are blocked. Open your browser site settings for this page and allow notifications, then return here to enable.
        </p>
      )}

      {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mt-2 max-w-sm">{error}</p>}
      {success && <p className="text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2 mt-2 max-w-sm">{success}</p>}
    </div>
  )
}
