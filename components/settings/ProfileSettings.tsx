'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAppUser } from '@/contexts/AppUserContext'
import type { AppUser } from '@/types/supabase'
import RichTextEditor from '@/components/ui/RichTextEditor'
import ThemeToggle from '@/components/layout/ThemeToggle'
import NotificationSettings from '@/components/settings/NotificationSettings'

export default function ProfileSettings() {
  const user = useAppUser()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [signature, setSignature] = useState(
    ((user.settings as Record<string, unknown>)?.signature as string) ?? ''
  )
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const initials = (fullName || user.email)
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      // Upload avatar first if changed
      if (avatarFile) {
        const form = new FormData()
        form.append('avatar', avatarFile)
        const res = await fetch('/api/settings/avatar', { method: 'POST', body: form })
        const json = await res.json() as { avatar_url?: string; error?: string }
        if (!res.ok) { setError(json.error ?? 'Avatar upload failed'); return }
        setAvatarUrl(json.avatar_url ?? avatarUrl)
        setAvatarFile(null)
        setAvatarPreview(null)
      }

      // Save profile
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, signature }),
      })
      const json = await res.json() as AppUser & { error?: string }
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }

      setSaved(true)
      router.refresh()
    })
  }

  const displayAvatar = avatarPreview ?? avatarUrl

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Profile photo</h3>
        <div className="flex items-center gap-4">
          <div className="relative">
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayAvatar}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover border-2 border-white/10"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-cbba-purple flex items-center justify-center text-white text-lg font-semibold border-2 border-white/10">
                {initials}
              </div>
            )}
          </div>
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {avatarPreview ? 'Change photo' : 'Upload photo'}
            </button>
            {avatarPreview && (
              <button
                onClick={() => { setAvatarPreview(null); setAvatarFile(null) }}
                className="ml-2 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
            <p className="text-xs text-gray-600 mt-1.5">JPG, PNG or WebP. Max 2MB.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Full name */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Display name</h3>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="w-full max-w-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple transition-colors"
        />
        <p className="text-xs text-gray-600 mt-1.5">Shown to teammates. Not visible to contacts.</p>
      </div>

      {/* Email */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-1.5">Email</h3>
        <p className="text-sm text-gray-400">{user.email}</p>
        <p className="text-xs text-gray-600 mt-0.5">Contact your admin to change your email.</p>
      </div>

      {/* Signature */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Email signature</h3>
        <p className="text-xs text-gray-500 mb-2">Automatically appended to outgoing emails.</p>
        <div className="w-full bg-white/5 border border-white/10 rounded-lg overflow-hidden focus-within:border-cbba-purple transition-colors">
          <RichTextEditor
            value={signature}
            onChange={setSignature}
            placeholder="e.g. Jane Smith&#10;Registrations Manager&#10;CBBA Storm Basketball"
            minRows={5}
          />
        </div>
      </div>

      {/* Notifications */}
      <NotificationSettings />

      {/* Appearance */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Appearance</h3>
        <div className="w-fit rounded-lg bg-white/5 border border-white/10">
          <ThemeToggle />
        </div>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      {saved && <p className="text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2">Saved successfully.</p>}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="px-4 py-2 rounded-lg bg-cbba-purple text-white text-sm font-medium hover:bg-cbba-purple-light disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  )
}
