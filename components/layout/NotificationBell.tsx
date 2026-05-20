'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  type: 'assignment' | 'live_chat' | 'app_update'
  title: string
  body: string | null
  read: boolean
  conversation_id: string | null
  created_at: string
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    fetchNotifications()
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-' + userId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 50))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function fetchNotifications() {
    const res = await fetch('/api/notifications')
    if (res.ok) setNotifications(await res.json())
  }

  async function markRead(n: Notification) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
    }
    if (n.conversation_id) {
      router.push(`/inbox?conversation=${n.conversation_id}`)
    }
    setOpen(false)
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read_all' }) })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function typeIcon(type: Notification['type']) {
    if (type === 'assignment') return '👤'
    if (type === 'live_chat') return '💬'
    return '📢'
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors duration-150"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cbba-purple text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-80 bg-cbba-navy-dark border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-xs font-semibold text-white">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-cbba-purple hover:text-cbba-purple-light transition-colors">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-500 px-4 py-6 text-center">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors flex gap-3 items-start ${!n.read ? 'bg-cbba-purple/5' : ''}`}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-medium truncate ${n.read ? 'text-gray-400' : 'text-white'}`}>{n.title}</p>
                      <span className="text-[10px] text-gray-600 flex-shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.body && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{n.body}</p>}
                    {!n.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cbba-purple mt-1" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
