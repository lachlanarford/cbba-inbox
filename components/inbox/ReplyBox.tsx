'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import EmailInput from '@/components/ui/EmailInput'

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

interface ReplyBoxProps {
  conversationId: string
  channel?: string
  contactEmail?: string | null
  lastInboundCc?: string[]
}

export default function ReplyBox({ conversationId, channel, contactEmail, lastInboundCc = [] }: ReplyBoxProps) {
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
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [toEmail, setToEmail] = useState(contactEmail ?? '')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isGmail = channel === 'gmail'

  const draftKey = `cbba-draft:${conversationId}`

  useEffect(() => {
    setContent('')
    setIsNote(false)
    setCollapsed(true)
    setAttachments([])
    setToEmail(contactEmail ?? '')
    setCc('')
    setBcc('')
    setShowCc(false)
    setShowBcc(false)
    setReplyAll(false)
    try {
      const saved = localStorage.getItem(`cbba-draft:${conversationId}`)
      if (saved) {
        const draft = JSON.parse(saved) as { content: string; isNote: boolean }
        if (draft.content) {
          setContent(draft.content)
          setIsNote(draft.isNote ?? false)
          setCollapsed(false)
        }
      }
    } catch {}
  }, [conversationId])

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

    setSending(true)
    setError(null)

    const res = await fetch(`/api/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: trimmed,
        isNote,
        isAiSuggested: aiSuggested && !isNote,
        attachments: isNote ? [] : attachments,
        to: (!isNote && isGmail && toEmail.trim()) ? toEmail.trim() : undefined,
        cc: (!isNote && isGmail && cc.trim()) ? cc.split(',').map((e) => e.trim()).filter(Boolean) : [],
        bcc: (!isNote && isGmail && bcc.trim()) ? bcc.split(',').map((e) => e.trim()).filter(Boolean) : [],
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Failed to send')
      setSending(false)
      return
    }

    localStorage.removeItem(`cbba-draft:${conversationId}`)
    setContent('')
    setAiSuggested(false)
    setAttachments([])
    setCc('')
    setBcc('')
    setShowCc(false)
    setShowBcc(false)
    setReplyAll(false)
    setSending(false)
    setCollapsed(true)
    setToEmail(contactEmail ?? '')
  }, [content, conversationId, isNote, sending, aiSuggested, attachments, isGmail, toEmail, cc, bcc, contactEmail])

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
        <button
          onClick={() => setCollapsed(false)}
          className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
            hasDraft
              ? 'border-cbba-purple/40 bg-cbba-purple/5 text-gray-300 hover:border-cbba-purple/60'
              : 'border-white/10 bg-cbba-navy-light text-gray-500 hover:text-gray-300 hover:border-white/20'
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
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 border-t border-white/5 bg-cbba-navy">
      {/* Tab row */}
      <div className="flex items-center gap-0 px-4 pt-3">
        <div className="flex items-center">
          {/* Reply (single recipient) */}
          <button
            onClick={() => { setIsNote(false); setReplyAll(false) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-t border-l border-r transition-colors ${
              !isNote && !replyAll
                ? 'bg-cbba-navy-light text-white border-white/10'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            Reply
          </button>

          {/* Reply All — only shown for Gmail when there are CC recipients */}
          {isGmail && lastInboundCc.length > 0 && (
            <button
              onClick={() => {
                setIsNote(false)
                setReplyAll(true)
                setShowCc(true)
                setCc(lastInboundCc.join(', '))
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-t border-l border-r transition-colors ${
                !isNote && replyAll
                  ? 'bg-cbba-navy-light text-white border-white/10'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              Reply All
            </button>
          )}

          <button
            onClick={() => { setIsNote(true); setReplyAll(false) }}
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

        {/* To / CC / BCC — Gmail reply only, always visible */}
        {isGmail && !isNote && (
          <div className="border-b border-white/8 flex-shrink-0">
            {/* To row */}
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="text-[11px] text-gray-600 w-6 flex-shrink-0">To</span>
              <EmailInput
                value={toEmail}
                onChange={setToEmail}
                placeholder="recipient@example.com"
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
                <span className="text-[11px] text-gray-600 w-6 flex-shrink-0">CC</span>
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
                <span className="text-[11px] text-gray-600 w-6 flex-shrink-0">BCC</span>
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
        <div className="overflow-y-auto flex-1 min-h-[100px]">
          {isNote ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => { setContent(e.target.value); if (aiSuggested) setAiSuggested(false) }}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSend() } }}
              placeholder="Add an internal note visible only to your team..."
              rows={5}
              className="w-full h-full px-3 pt-3 bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none"
            />
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
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 text-xs hover:text-white hover:bg-white/5 transition-colors"
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
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 text-xs hover:text-white hover:bg-white/5 transition-colors"
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
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 text-xs hover:text-purple-400 hover:bg-purple-500/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={isEmpty || sending}
            title={`${typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'}+Enter`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            {sending ? 'Sending...' : isNote ? 'Add Note' : 'Send'}
          </button>
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
