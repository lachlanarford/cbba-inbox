'use client'

import { useState } from 'react'

interface ContactData {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

interface ContactModalProps {
  mode: 'add' | 'edit'
  initial?: ContactData
  onClose: () => void
  onSaved: (contact: ContactData) => void
}

export default function ContactModal({ mode, initial, onClose, onSaved }: ContactModalProps) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!fullName.trim() && !email.trim()) {
      setError('Name or email is required.')
      return
    }
    setSaving(true)
    setError('')

    try {
      let res: Response
      if (mode === 'add') {
        res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName, email, phone }),
        })
      } else {
        res = await fetch(`/api/contacts/${initial!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName, email, phone }),
        })
      }

      const data = await res.json() as ContactData & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      onSaved(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-cbba-navy-dark border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'add' ? 'Add Contact' : 'Edit Contact'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0400 000 000"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cbba-purple transition-colors"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="bg-white/5 hover:bg-white/10 text-gray-400 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-cbba-purple hover:bg-cbba-purple-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
