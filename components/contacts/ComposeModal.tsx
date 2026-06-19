'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import EmailInput from '@/components/ui/EmailInput'

interface ComposeModalProps {
  // Single recipient mode
  to?: string
  contactId?: string
  contactName?: string
  // Bulk mode (email all)
  bccList?: string[]
  listName?: string
  onClose: () => void
}

export default function ComposeModal({ to, contactId, contactName, bccList, listName, onClose }: ComposeModalProps) {
  const router = useRouter()
  const isBulk = (bccList && bccList.length > 0) && !to
  const [toInput, setToInput] = useState(to ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const recipientLabel = isBulk
    ? `${bccList!.length} contact${bccList!.length !== 1 ? 's' : ''} via BCC${listName ? ` (${listName})` : ''}`
    : contactName ? `${contactName} <${toInput}>` : toInput

  async function handleSend() {
    if (!toInput.trim() && !isBulk) { setError('To address is required'); return }
    if (!subject.trim()) { setError('Subject is required'); return }
    if (!body.trim()) { setError('Message body is required'); return }

    setSending(true)
    setError('')

    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: isBulk ? '' : toInput.trim(),
          bcc: isBulk ? bccList : undefined,
          subject: subject.trim(),
          content: body.trim(),
          contactId: contactId ?? undefined,
        }),
      })

      const data = await res.json() as { success?: boolean; conversationId?: string; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Failed to send')
        setSending(false)
        return
      }

      onClose()
      if (data.conversationId) {
        router.push(`/inbox/${data.conversationId}`)
      }
    } catch {
      setError('Network error, please try again')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-cbba-navy-dark border border-white/10 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">New email</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto">
          {/* To */}
          <div className="px-5 py-3 border-b border-white/5">
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-14 pt-2 flex-shrink-0">To</span>
              {isBulk ? (
                <div className="flex-1 py-1.5">
                  <span className="text-sm text-cbba-purple">{recipientLabel}</span>
                </div>
              ) : (
                <EmailInput
                  value={toInput}
                  onChange={setToInput}
                  placeholder="recipient@example.com"
                  className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none py-1.5"
                  single
                />
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="px-5 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-14 flex-shrink-0">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none py-1.5"
              />
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={8}
              className="w-full bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : (
            <span className="text-xs text-gray-600">
              {isBulk ? `Sending to ${bccList!.length} recipients via BCC` : 'Sent via Gmail'}
            </span>
          )}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light transition-colors disabled:opacity-50"
            >
              {sending ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
