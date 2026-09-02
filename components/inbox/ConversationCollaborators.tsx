'use client'

import { useEffect, useState } from 'react'
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

export default function ConversationCollaborators({
  conversationId,
  assignedUserId,
}: ConversationCollaboratorsProps) {
  const currentUser = useAppUser()
  const allUsers = useUsers()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

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

  const collaboratorIds = new Set(collaborators.map((c) => c.user_id))
  const availableUsers = allUsers.filter(
    (u) => u.id !== assignedUserId && u.id !== currentUser.id && !collaboratorIds.has(u.id)
  )

  async function addCollaborator(userId: string) {
    setAdding(true)
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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Collaborators</span>
      {loading ? (
        <span className="text-xs text-gray-600">...</span>
      ) : (
        <>
          {collaborators.map((c) => (
            <span
              key={c.user_id}
              className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300"
            >
              {c.user.avatar_url ? (
                <img src={c.user.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-cbba-purple/40 flex items-center justify-center text-[9px] text-white">
                  {displayName(c.user).charAt(0).toUpperCase()}
                </span>
              )}
              <span className="max-w-[80px] truncate">{displayName(c.user)}</span>
              <button
                type="button"
                onClick={() => { void removeCollaborator(c.user_id) }}
                className="text-gray-500 hover:text-white transition-colors"
                aria-label={`Remove ${displayName(c.user)}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {availableUsers.length > 0 && (
            <select
              disabled={adding}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  void addCollaborator(e.target.value)
                  e.target.value = ''
                }
              }}
              className="text-xs px-2 py-0.5 rounded-full border border-dashed border-white/15 bg-transparent text-gray-400 focus:outline-none focus:border-cbba-purple cursor-pointer disabled:opacity-40"
            >
              <option value="">+ Add</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{displayName(u)}</option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  )
}
