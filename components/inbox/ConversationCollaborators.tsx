'use client'

import { useEffect, useRef, useState } from 'react'
import { useUsers } from '@/lib/hooks/useUsers'
import { useAppUser } from '@/contexts/AppUserContext'
import type { StaffUser } from '@/types/database'

interface Collaborator {
  user_id: string
  user: {
    id: string
    full_name: string | null
    avatar_url: string | null
    email: string
  }
}

interface ConversationCollaboratorsProps {
  conversationId: string
  assignedUserId: string | null
}

const chevron = (
  <svg className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
)

const pillSelectClass =
  'appearance-none cursor-pointer rounded-full pl-2.5 pr-6 py-0.5 text-xs font-medium border bg-white/5 text-gray-300 border-white/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40'

const pillChipClass =
  'inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full text-xs font-medium border bg-white/5 text-gray-300 border-white/10'

export default function ConversationCollaborators({
  conversationId,
  assignedUserId,
}: ConversationCollaboratorsProps) {
  const currentUser = useAppUser()
  const allUsers = useUsers()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await fetch(`/api/conversations/${conversationId}/collaborators`)
    if (res.ok) {
      setCollaborators(await res.json() as Collaborator[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [conversationId])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const collaboratorIds = new Set(collaborators.map((c) => c.user_id))
  const availableUsers = allUsers.filter(
    (u) => u.id !== assignedUserId && u.id !== currentUser.id && !collaboratorIds.has(u.id)
  )

  async function addCollaborator(userId: string) {
    setAdding(true)
    setMenuOpen(false)
    const res = await fetch(`/api/conversations/${conversationId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setCollaborators(await res.json() as Collaborator[])
    }
    setAdding(false)
  }

  async function removeCollaborator(userId: string) {
    const res = await fetch(`/api/conversations/${conversationId}/collaborators`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setCollaborators(await res.json() as Collaborator[])
    }
  }

  function displayName(u: Pick<StaffUser, 'full_name' | 'email'>): string {
    return u.full_name?.trim() || u.email
  }

  if (loading) {
    return (
      <span className="text-xs text-gray-500">...</span>
    )
  }

  return (
    <>
      {collaborators.map((c) => (
        <span key={c.user_id} className={pillChipClass}>
          {c.user.avatar_url ? (
            <img src={c.user.avatar_url} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full bg-cbba-purple/30 flex items-center justify-center text-[8px] text-white">
              {displayName(c.user).charAt(0).toUpperCase()}
            </span>
          )}
          <span className="max-w-[72px] truncate">{displayName(c.user)}</span>
          <button
            type="button"
            onClick={() => { void removeCollaborator(c.user_id) }}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label={`Remove ${displayName(c.user)}`}
          >
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      {availableUsers.length > 0 && (
        <div ref={menuRef} className="relative inline-flex items-center">
          <button
            type="button"
            disabled={adding}
            onClick={() => setMenuOpen((v) => !v)}
            className={`${pillSelectClass} pr-6 text-left disabled:opacity-40`}
          >
            + Collaborator
          </button>
          {chevron}
          {menuOpen && (
            <div className="absolute top-full mt-1 left-0 z-30 bg-cbba-navy-dark border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px] max-h-48 overflow-y-auto">
              {availableUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { void addCollaborator(u.id) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-300 [@media(hover:hover)]:hover:bg-white/5 transition-colors"
                >
                  {displayName(u)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
