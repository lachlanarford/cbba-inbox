'use client'

import { useState, useEffect, useTransition } from 'react'
import { useAppUser } from '@/contexts/AppUserContext'

const DEPARTMENTS = [
  { value: 'Reps',  label: 'Reps' },
  { value: 'Comps', label: 'Comps' },
  { value: 'LTP',   label: 'Learn to Play' },
  { value: 'Referees', label: 'Referees' },
  { value: 'Other', label: 'Other' },
] as const

interface UserRow {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'staff'
  is_active: boolean
  department: string | null
  created_at: string
}

function initials(user: UserRow): string {
  if (user.full_name) {
    return user.full_name
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase()
  }
  return user.email[0].toUpperCase()
}

const AVATAR_COLORS = [
  'bg-[#604484]',
  'bg-[#F58945]',
  'bg-[#60a5fa]',
  'bg-[#4ade80]',
  'bg-[#f472b6]',
  'bg-[#a78bfa]',
]

function avatarColor(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

export default function UserManager() {
  const currentUser = useAppUser()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff')
  const [inviteDept, setInviteDept] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch('/api/admin/users')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? 'Failed to load users')
        return d as UserRow[]
      })
      .then((d) => { setUsers(d); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [])

  async function updateUser(id: string, patch: { role?: 'admin' | 'staff'; is_active?: boolean; department?: string | null }) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json() as UserRow
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
    }
  }

  function handleInvite() {
    setInviteError(null)
    startTransition(async () => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole, department: inviteDept || null }),
      })
      const json = await res.json() as UserRow & { error?: string }
      if (!res.ok) {
        setInviteError(json.error ?? 'Invite failed')
        return
      }
      setUsers((prev) => [...prev, json])
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('staff')
      setInviteDept('')
    })
  }

  if (loading) {
    return <div className="text-xs text-gray-500 p-6">Loading users...</div>
  }

  if (error) {
    return <div className="text-xs text-red-400 p-6">{error}</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-white">Users</h2>
          <p className="text-xs text-gray-500 mt-0.5">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#604484] text-white text-xs font-medium hover:bg-[#7a5ba0] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Invite user
        </button>
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/3">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Department</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => {
              const isSelf = user.id === currentUser.id
              return (
                <tr
                  key={user.id}
                  className={`border-b border-white/5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${avatarColor(user.id)}`}>
                        {initials(user)}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-white">
                          {user.full_name ?? <span className="text-gray-500 italic">No name</span>}
                          {isSelf && <span className="ml-1.5 text-[10px] text-gray-500">(you)</span>}
                        </div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.department ?? ''}
                      onChange={(e) => updateUser(user.id, { department: e.target.value || null })}
                      className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#604484] transition-colors"
                    >
                      <option value="">No department</option>
                      {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      disabled={isSelf}
                      onChange={(e) => updateUser(user.id, { role: e.target.value as 'admin' | 'staff' })}
                      className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-[#604484] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={isSelf}
                      onClick={() => updateUser(user.id, { is_active: !user.is_active })}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        user.is_active
                          ? 'bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400'
                          : 'bg-red-500/10 text-red-400 hover:bg-green-500/10 hover:text-green-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-cbba-navy-light border border-white/10 rounded-xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-4">Invite a team member</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Email address *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#604484] transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Full name (optional)</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#604484] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Department (optional)</label>
                <select
                  value={inviteDept}
                  onChange={(e) => setInviteDept(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#604484] transition-colors"
                >
                  <option value="">No department</option>
                  {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'staff')}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#604484] transition-colors"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {inviteError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{inviteError}</p>
              )}
            </div>

            <p className="text-xs text-gray-600 mt-4">
              An invitation email will be sent. They can set their password when they accept.
            </p>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowInvite(false); setInviteError(null) }}
                className="flex-1 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={isPending || !inviteEmail.trim()}
                className="flex-1 px-3 py-2 rounded-lg bg-[#604484] text-white text-xs font-medium hover:bg-[#7a5ba0] transition-colors disabled:opacity-50"
              >
                {isPending ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
