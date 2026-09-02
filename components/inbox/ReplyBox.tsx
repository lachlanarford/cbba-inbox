'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import EmailInput from '@/components/ui/EmailInput'
import { createClient } from '@/lib/supabase/client'
import { buildForwardQuote } from '@/lib/email/forward-quote'
import { useUsers } from '@/lib/hooks/useUsers'
import { useAppUser } from '@/contexts/AppUserContext'

interface CannedResponse {
  id: string
  title: string
  content: string
}

interface AttachmentFile {
  name: string
  mimeType: string
  data: string // base64
  size: number
}

interface GmailAccount {
  id: string
  identifier: string
}

interface ReplyBoxProps {
  conversationId: string
  channel?: string
  contactEmail?: string | null
  lastInboundCc?: string[]
  channelConfigId?: string | null
  fromEmail?: string | null
  contactName?: string | null
  subject?: string | null
  onSent?: () => void
}

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_TOTAL_BYTES = 25 * 1024 * 1024

export default function ReplyBox({
  conversationId,
  channel,
  contactEmail,
  lastInboundCc = [],
  channelConfigId,
  fromEmail,
  contactName,
  subject,
  onSent,
}: ReplyBoxProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [content, setContent] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [aiSuggested, setAiSuggested] = useState(false)
  const [showCanned, setShowCanned] = useState(false)
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [cannedSearch, setCannedSearch] = useState('')
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [replyAll, setReplyAll] = useState(false)
  const [isForward, setIsForward] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [toEmail, setToEmail] = useState(contactEmail ?? '')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([])
  const [fromConfigId, setFromConfigId] = useState(channelConfigId ?? '')
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const users = useUsers()
  const currentUser = useAppUser()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isGmail = channel === 'gmail'
  const conversationFromEmail = fromEmail ?? gmailAccounts.find((a) => a.id === channelConfigId)?.identifier ?? null
  const selectedFromEmail = gmailAccounts.find((a) => a.id === fromConfigId)?.identifier ?? conversationFromEmail
  const fromOverridden = !!(fromConfigId && channelConfigId && fromConfigId !== channelConfigId)

  const mentionCandidates = users.filter((u) => {
    if (u.id === currentUser.id) return false
    const name = (u.full_name ?? u.email).toLowerCase()
    return name.includes(mentionQuery.toLowerCase())
  }).slice(0, 6)

  function insertMention(user: { id: string; full_name: string | null; email: string }) {
    const el = textareaRef.current
    if (!el) return
    const name = user.full_name?.trim() || user.email
    const before = content.slice(0, el.selectionStart)
    const after = content.slice(el.selectionStart)
    const atIndex = before.lastIndexOf('@')
    if (atIndex === -1) return
    const next = `${before.slice(0, atIndex)}@${name} ${after}`
    setContent(next)
    setMentionedUserIds((prev) => prev.includes(user.id) ? prev : [...prev, user.id])
    setMentionOpen(false)
    setMentionQuery('')
    setMentionIndex(0)
  }

  function handleNoteChange(value: string) {
    setContent(value)
    if (aiSuggested) setAiSuggested(false)

    const el = textareaRef.current
    if (!el) return
    const pos = el.selectionStart
    const before = value.slice(0, pos)
    const atMatch = before.match(/@([\w\s.]*)$/)
    if (atMatch) {
      setMentionOpen(true)
      setMentionQuery(atMatch[1].trim())
      setMentionIndex(0)
    } else {
      setMentionOpen(false)
      setMentionQuery('')
    }
  }

  function handleNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
      return
    }
    if (!mentionOpen || mentionCandidates.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionIndex((i) => (i + 1) % mentionCandidates.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertMention(mentionCandidates[mentionIndex])
    } else if (e.key === 'Escape') {
      setMentionOpen(false)
    }
  }

  // Other people on the thread for Reply All — exclude our sending address and the To contact
  const replyAllRecipients = lastInboundCc.filter((addr) => {
    const lower = addr.toLowerCase()
    if (selectedFromEmail && lower === selectedFromEmail.toLowerCase()) return false
    if (conversationFromEmail && lower === conversationFromEmail.toLowerCase()) return false
    if (contactEmail && lower === contactEmail.toLowerCase()) return false
    return true
  })

  function applyReplyAll() {
    setIsNote(false)
    setIsForward(false)
    setReplyAll(true)
    setToEmail(contactEmail ?? '')
    if (replyAllRecipients.length > 0) {
      setShowCc(true)
      setCc(replyAllRecipients.join(', '))
    } else {
      setShowCc(false)
      setCc('')
    }
  }

  function applyReplyOnly() {
    setIsNote(false)
    setIsForward(false)
    setReplyAll(false)
    setToEmail(contactEmail ?? '')
    setShowCc(false)
    setCc('')
  }

  async function applyForward() {
    setIsNote(false)
    setReplyAll(false)
    setIsForward(true)
    setToEmail('')
    setShowCc(false)
    setCc('')
    setCollapsed(false)

    const supabase = createClient()
    const { data: latest } = await supabase
      .from('messages')
      .select('content, from_address, from_name, created_at, sender_type')
      .eq('conversation_id', conversationId)
      .eq('is_internal_note', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latest?.content) return

    const from =
      latest.from_name && latest.from_address
        ? `${latest.from_name} <${latest.from_address}>`
        : latest.from_address || latest.from_name || contactName || 'Unknown'
    const quote = buildForwardQuote({
      subject: subject || '(no subject)',
      from,
      date: latest.created_at,
      to: contactEmail,
      body: latest.content,
    })
    setContent((prev) => {
      const text = getTextContent(prev)
      if (text && prev.includes('Forwarded message')) return prev
      if (text) return `${prev}${quote}`
      return quote
    })
  }

  const draftKey = `cbba-draft:${conversationId}`

  useEffect(() => {
    setContent('')
    setIsNote(false)
    setIsForward(false)
    setCollapsed(true)
    setAttachments([])
    setToEmail(contactEmail ?? '')
    setBcc('')
    setShowBcc(false)
    setFromConfigId(channelConfigId ?? '')
    // Default to Reply All when the inbound message had other recipients
    if (replyAllRecipients.length > 0) {
      setReplyAll(true)
      setShowCc(true)
      setCc(replyAllRecipients.join(', '))
    } else {
      setReplyAll(false)
      setShowCc(false)
      setCc('')
    }
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const draft = JSON.parse(saved) as { content: string; isNote: boolean }
        if (draft.content) {
          setContent(draft.content)
          setIsNote(draft.isNote ?? false)
          setCollapsed(false)
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply CCs when conversation or inbound CC list changes
  }, [conversationId, channelConfigId, contactEmail, lastInboundCc.join('|')])

  // Keep Reply All CCs in sync if the From account changes (drop our own address)
  useEffect(() => {
    if (!replyAll || isNote || isForward) return
    if (replyAllRecipients.length === 0) {
      setCc('')
      setShowCc(false)
      return
    }
    setShowCc(true)
    setCc(replyAllRecipients.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromConfigId, replyAllRecipients.join('|'), replyAll, isNote])

  useEffect(() => {
    if (!isGmail) return
    fetch('/api/channel-configs/gmail')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: GmailAccount[]) => {
        const accounts = Array.isArray(data) ? data : []
        setGmailAccounts(accounts)
        setFromConfigId((prev) => {
          if (prev && accounts.some((a) => a.id === prev)) return prev
          if (channelConfigId && accounts.some((a) => a.id === channelConfigId)) return channelConfigId
          return accounts[0]?.id ?? ''
        })
      })
      .catch(() => setGmailAccounts([]))
  }, [isGmail, channelConfigId])

  useEffect(() => {
    if (!content) {
      localStorage.removeItem(draftKey)
      return
    }
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ content, isNote }))
    }, 600)
    return () => clearTimeout(timer)
  }, [content, isNote, draftKey])

  function getTextContent(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim()
  }

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    const textOnly = getTextContent(trimmed)
    if (!textOnly || sending) return
    if (isForward && !toEmail.trim()) {
      setError('Enter a recipient to forward to')
      return
    }

    setSending(true)
    setError(null)

    const res = await fetch(`/api/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: trimmed,
        isNote,
        isForward: isForward && !isNote,
        isAiSuggested: aiSuggested && !isNote,
        attachments: isNote ? [] : attachments,
        to: (!isNote && isGmail && toEmail.trim()) ? toEmail.trim() : undefined,
        cc: (!isNote && isGmail && cc.trim()) ? cc.split(',').map((e) => e.trim()).filter(Boolean) : [],
        bcc: (!isNote && isGmail && bcc.trim()) ? bcc.split(',').map((e) => e.trim()).filter(Boolean) : [],
        channelConfigId: (!isNote && isGmail && fromConfigId) ? fromConfigId : undefined,
        mentionedUserIds: isNote ? mentionedUserIds : undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Failed to send')
      setSending(false)
      return
    }

    onSent?.()

    localStorage.removeItem(draftKey)
    setContent('')
    setAiSuggested(false)
    setAttachments([])
    setBcc('')
    setShowBcc(false)
    setSending(false)
    setCollapsed(true)
    setIsForward(false)
    setMentionedUserIds([])
    setToEmail(contactEmail ?? '')
    if (replyAllRecipients.length > 0) {
      setReplyAll(true)
      setShowCc(true)
      setCc(replyAllRecipients.join(', '))
    } else {
      setReplyAll(false)
      setShowCc(false)
      setCc('')
    }
  }, [content, conversationId, isNote, isForward, sending, aiSuggested, attachments, isGmail, toEmail, cc, bcc, contactEmail, fromConfigId, channelConfigId, lastInboundCc, selectedFromEmail, conversationFromEmail, onSent, mentionedUserIds])

  function discardDraft() {
    localStorage.removeItem(draftKey)
    setContent('')
    setAiSuggested(false)
    setAttachments([])
    setError(null)
    setIsForward(false)
    setCollapsed(true)
  }

  useEffect(() => {
    fetch('/api/canned-responses')
      .then((r) => r.json())
      .then((d: CannedResponse[]) => setCannedResponses(d))
      .catch(() => {})
  }, [])

  function insertCanned(item: CannedResponse) {
    setContent(item.content)
    setShowCanned(false)
    setCannedSearch('')
    setAiSuggested(false)
  }

  function resolveFileMimeType(file: File): string {
    if (file.type) return file.type
    // Browsers sometimes return empty type for Office files -- fall back by extension
    const ext = file.name.split('.').pop()?.toLowerCase()
    const byExt: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls:  'application/vnd.ms-excel',
      csv:  'text/csv',
      ods:  'application/vnd.oasis.opendocument.spreadsheet',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc:  'application/msword',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt:  'application/vnd.ms-powerpoint',
      pdf:  'application/pdf',
    }
    return (ext && byExt[ext]) || 'application/octet-stream'
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const existingTotal = attachments.reduce((sum, a) => sum + a.size, 0)
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" is too large. Max file size is 20 MB.`)
        e.target.value = ''
        return
      }
    }
    const newTotal = existingTotal + files.reduce((sum, f) => sum + f.size, 0)
    if (newTotal > MAX_TOTAL_BYTES) {
      setError('Attachments exceed the 25 MB Gmail limit.')
      e.target.value = ''
      return
    }

    setError(null)
    const loaded = await Promise.all(
      files.map(
        (file) =>
          new Promise<AttachmentFile>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = reader.result as string
              const base64 = dataUrl.split(',')[1] ?? ''
              resolve({ name: file.name, mimeType: resolveFileMimeType(file), data: base64, size: file.size })
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
      )
    )
    setAttachments((prev) => [...prev, ...loaded])
    e.target.value = ''
  }

  const handleSuggestReply = useCallback(async () => {
    setSuggesting(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/suggest-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId }),
      })
      if (!res.ok) throw new Error('Failed to get suggestion')
      const data = await res.json() as { suggestion: string }
      setContent(data.suggestion)
      setAiSuggested(true)
      textareaRef.current?.focus()
    } catch {
      setError('Could not generate suggestion')
    } finally {
      setSuggesting(false)
    }
  }, [conversationId])

  function handleContentChange(html: string) {
    setContent(html)
    if (aiSuggested) setAiSuggested(false)
  }

  const isEmpty = !getTextContent(content)

  if (collapsed) {
    const hasDraft = !!content
    return (
      <div className="flex-shrink-0 border-t border-white/5 bg-cbba-navy px-4 py-3">
        <div className="relative">
          <button
            onClick={() => setCollapsed(false)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm active:scale-[0.99] transition-[border-color,background-color,color,transform] duration-150 ease-out ${
              hasDraft
                ? 'border-cbba-purple/40 bg-cbba-purple/5 text-gray-300 [@media(hover:hover)]:hover:border-cbba-purple/60 pr-10'
                : 'border-white/10 bg-cbba-navy-light text-gray-500 [@media(hover:hover)]:hover:text-gray-300 [@media(hover:hover)]:hover:border-white/20'
            }`}
          >
            {hasDraft ? (
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cbba-purple flex-shrink-0" />
                Draft saved — click to continue
              </span>
            ) : (
              'Reply to this conversation...'
            )}
          </button>
          {hasDraft && (
            <button
              type="button"
              onClick={discardDraft}
              title="Delete draft"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-500 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/10 active:scale-[0.96] transition-[color,background-color,transform] duration-150 ease-out"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 border-t border-white/5 bg-cbba-navy">
      {/* Tab row */}
      <div className="flex items-center gap-0 px-4 pt-3">
        <div className="flex items-center">
          {/* Reply (single recipient — clears CC) */}
          <button
            onClick={applyReplyOnly}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-t border-l border-r transition-colors ${
              !isNote && !replyAll && !isForward
                ? 'bg-cbba-navy-light text-white border-white/10'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            Reply
          </button>

          {/* Reply All — include everyone who was on the inbound thread */}
          {isGmail && replyAllRecipients.length > 0 && (
            <button
              onClick={applyReplyAll}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-t border-l border-r transition-colors ${
                !isNote && replyAll && !isForward
                  ? 'bg-cbba-navy-light text-white border-white/10'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              Reply All
            </button>
          )}

          {isGmail && (
            <button
              onClick={() => { void applyForward() }}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-t border-l border-r transition-colors ${
                !isNote && isForward
                  ? 'bg-cbba-navy-light text-white border-white/10'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              Forward
            </button>
          )}

          <button
            onClick={() => { setIsNote(true); setReplyAll(false); setIsForward(false) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-t border-l border-r transition-colors ${
              isNote
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            Internal Note
          </button>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="ml-auto p-1.5 text-gray-600 hover:text-gray-400 transition-colors"
          title="Collapse"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Compose box — flex column so action bar never scrolls off screen */}
      <div className={`mx-4 mb-4 rounded-b-xl rounded-tr-xl border flex flex-col overflow-hidden max-h-[60vh] ${isNote ? 'border-amber-500/20' : 'border-white/10'}`}>

        {/* From / To / CC / BCC — Gmail reply only, always visible */}
        {isGmail && !isNote && (
          <div className="border-b border-white/8 flex-shrink-0">
            {/* From row */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
              <span className="text-[11px] text-gray-600 w-8 flex-shrink-0">From</span>
              {gmailAccounts.length > 1 ? (
                <select
                  value={fromConfigId}
                  onChange={(e) => setFromConfigId(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-white focus:outline-none cursor-pointer truncate"
                >
                  {gmailAccounts.map((a) => (
                    <option key={a.id} value={a.id} className="bg-cbba-navy text-white light:bg-white light:text-gray-900">
                      {a.identifier}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-xs text-white truncate">
                  {selectedFromEmail ?? 'No Gmail account'}
                </span>
              )}
            </div>
            {fromOverridden && !isForward && conversationFromEmail && selectedFromEmail && (
              <p className="px-3 py-1.5 text-[10px] text-amber-400/90 border-b border-white/5 bg-amber-500/5">
                This reply will send from {selectedFromEmail} and move the conversation to that inbox so you can keep the thread.
              </p>
            )}
            {/* To row */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-[11px] text-gray-600 w-8 flex-shrink-0">To</span>
              <EmailInput
                value={toEmail}
                onChange={setToEmail}
                placeholder={isForward ? 'Forward to...' : 'recipient@example.com'}
                className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
                single
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                {!showCc && (
                  <button
                    onClick={() => setShowCc(true)}
                    className="text-[10px] font-medium text-gray-600 hover:text-gray-300 px-1.5 py-0.5 rounded transition-colors"
                  >
                    +CC
                  </button>
                )}
                {!showBcc && (
                  <button
                    onClick={() => setShowBcc(true)}
                    className="text-[10px] font-medium text-gray-600 hover:text-gray-300 px-1.5 py-0.5 rounded transition-colors"
                  >
                    +BCC
                  </button>
                )}
              </div>
            </div>
            {showCc && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5">
                <span className="text-[11px] text-gray-600 w-8 flex-shrink-0">CC</span>
                <EmailInput
                  value={cc}
                  onChange={setCc}
                  placeholder="name@example.com, another@example.com"
                  autoFocus
                  className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
                />
              </div>
            )}
            {showBcc && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5">
                <span className="text-[11px] text-gray-600 w-8 flex-shrink-0">BCC</span>
                <EmailInput
                  value={bcc}
                  onChange={setBcc}
                  placeholder="name@example.com"
                  autoFocus={!showCc}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Editor — scrolls when content is long, fills available space */}
        <div className="overflow-y-auto flex-1 min-h-[100px] relative">
          {isNote ? (
            <>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleNoteChange(e.target.value)}
                onKeyDown={handleNoteKeyDown}
                placeholder="Add an internal note... Type @ to mention a teammate"
                rows={5}
                className="w-full h-full px-3 pt-3 bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none"
              />
              {mentionOpen && mentionCandidates.length > 0 && (
                <div className="absolute left-3 right-3 bottom-2 bg-cbba-navy border border-white/10 rounded-lg shadow-xl z-10 py-1 max-h-36 overflow-y-auto">
                  {mentionCandidates.map((u, i) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertMention(u) }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        i === mentionIndex ? 'bg-cbba-purple/30 text-white' : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      {u.full_name ?? u.email}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <RichTextEditor
              value={content}
              onChange={handleContentChange}
              placeholder="Type your reply..."
              minRows={5}
            />
          )}
        </div>

        {/* Attachment chips — always visible, never scrolls away */}
        {attachments.length > 0 && (
          <div className="flex-shrink-0 flex flex-wrap gap-1.5 px-3 py-2 border-t border-white/5">
            {attachments.map((att, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 max-w-[180px]">
                <svg className="w-3 h-3 flex-shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
                </svg>
                <span className="truncate">{att.name}</span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-0.5 flex-shrink-0 text-gray-600 hover:text-white transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Error — always visible */}
        {error && (
          <div className="flex-shrink-0 px-3 py-2 border-t border-white/5 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Action bar — flex-shrink-0 so Send is always visible */}
        <div className={`flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-t ${isNote ? 'border-amber-500/10 bg-amber-500/3' : 'border-white/5'}`}>
          <div className="flex items-center gap-1">
            {!isNote && (
              <>
                {/* Attach */}
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilePick} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach files"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 text-xs [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/5 active:scale-[0.97] transition-[color,background-color,transform] duration-150 ease-out"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
                  </svg>
                  <span className="hidden sm:inline">
                    Attach{attachments.length > 0 ? ` (${attachments.length})` : ''}
                  </span>
                </button>

                {/* Templates */}
                {cannedResponses.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => { setShowCanned((v) => !v); setCannedSearch('') }}
                      title="Insert a template"
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 text-xs [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/5 active:scale-[0.97] transition-[color,background-color,transform] duration-150 ease-out"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      <span className="hidden sm:inline">Templates</span>
                    </button>
                    {showCanned && (
                      <div className="absolute bottom-full left-0 mb-2 w-72 bg-cbba-navy border border-white/10 rounded-xl shadow-2xl z-10 overflow-hidden">
                        <div className="p-2 border-b border-white/5">
                          <input
                            type="text"
                            value={cannedSearch}
                            onChange={(e) => setCannedSearch(e.target.value)}
                            placeholder="Search templates..."
                            autoFocus
                            className="w-full bg-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {cannedResponses
                            .filter((c) => !cannedSearch || c.title.toLowerCase().includes(cannedSearch.toLowerCase()))
                            .map((item) => (
                              <button
                                key={item.id}
                                onClick={() => insertCanned(item)}
                                className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                              >
                                <p className="text-xs font-medium text-white">{item.title}</p>
                                <p className="text-[11px] text-gray-500 truncate mt-0.5">{item.content}</p>
                              </button>
                            ))}
                          {cannedResponses.filter((c) => !cannedSearch || c.title.toLowerCase().includes(cannedSearch.toLowerCase())).length === 0 && (
                            <p className="text-xs text-gray-600 px-3 py-4 text-center">No templates match</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI suggest */}
                <button
                  onClick={handleSuggestReply}
                  disabled={suggesting}
                  title="Suggest a reply with AI"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 text-xs [@media(hover:hover)]:hover:text-purple-400 [@media(hover:hover)]:hover:bg-purple-500/5 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-[color,background-color,transform] duration-150 ease-out"
                >
                  {suggesting ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 110 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                  ) : (
                    <SparkleIcon className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{suggesting ? 'Thinking...' : 'AI Reply'}</span>
                </button>
              </>
            )}

            {aiSuggested && (
              <span className="flex items-center gap-1 text-xs text-purple-400 ml-1">
                <SparkleIcon className="w-3 h-3" />
                AI draft
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isEmpty && (
              <button
                type="button"
                onClick={discardDraft}
                disabled={sending}
                title="Delete draft"
                className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/5 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-[color,background-color,transform] duration-150 ease-out"
              >
                Discard
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={isEmpty || sending || (isForward && !toEmail.trim())}
              title={`${typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'}+Enter`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cbba-purple text-white text-xs font-medium [@media(hover:hover)]:hover:bg-cbba-purple-light active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 transition-[background-color,transform] duration-150 ease-out"
            >
            {sending ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 110 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            {sending ? 'Sending...' : isNote ? 'Add Note' : isForward ? 'Forward' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}
