'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import RichTextEditor from '@/components/ui/RichTextEditor'

interface CannedResponse {
  id: string
  title: string
  content: string
}

interface ReplyBoxProps {
  conversationId: string
}

export default function ReplyBox({ conversationId }: ReplyBoxProps) {
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function getTextContent(html: string): string {
    // Strip HTML tags to get plain text for empty check
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
      body: JSON.stringify({ content: trimmed, isNote, isAiSuggested: aiSuggested && !isNote }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error ?? 'Failed to send')
      setSending(false)
      return
    }

    setContent('')
    setAiSuggested(false)
    setSending(false)
    setCollapsed(true)
  }, [content, conversationId, isNote, sending, aiSuggested])

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
    textareaRef.current?.focus()
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
    return (
      <div className="flex-shrink-0 border-t border-white/5 bg-cbba-navy px-4 py-3">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full text-left px-3 py-2.5 rounded-lg border border-white/10 bg-cbba-navy-light text-sm text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors"
        >
          Reply to this conversation...
        </button>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 border-t border-white/5 bg-cbba-navy">
      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 pt-3 border-b border-white/5">
        <button
          onClick={() => setIsNote(false)}
          className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
            !isNote
              ? 'bg-cbba-navy-light text-white border-t border-l border-r border-white/10'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Reply
        </button>
        <button
          onClick={() => setIsNote(true)}
          className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
            isNote
              ? 'bg-amber-500/10 text-amber-400 border-t border-l border-r border-amber-500/20'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Internal Note
        </button>
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

      {/* Editor */}
      <div className={`mx-4 mt-0 rounded-b-lg border overflow-hidden ${isNote ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/10 bg-cbba-navy-light'}`}>
        {isNote ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); if (aiSuggested) setAiSuggested(false) }}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSend() } }}
            placeholder="Add an internal note..."
            rows={4}
            className="w-full px-3 pt-3 bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none"
          />
        ) : (
          <RichTextEditor
            value={content}
            onChange={handleContentChange}
            placeholder="Type your reply..."
            minRows={4}
          />
        )}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-3">
            {aiSuggested && (
              <span className="flex items-center gap-1 text-xs text-purple-400">
                <SparkleIcon className="w-3 h-3" />
                AI suggested
              </span>
            )}
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            {!isNote && cannedResponses.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setShowCanned((v) => !v); setCannedSearch('') }}
                  title="Insert a template"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-400 text-xs hover:text-white hover:border-white/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  Templates
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
                    <div className="max-h-48 overflow-y-auto">
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
            {!isNote && (
              <button
                onClick={handleSuggestReply}
                disabled={suggesting}
                title="Suggest a reply with AI"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-400 text-xs hover:text-purple-400 hover:border-purple-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {suggesting ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 110 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                ) : (
                  <SparkleIcon className="w-3.5 h-3.5" />
                )}
                {suggesting ? 'Thinking...' : 'Suggest reply'}
              </button>
            )}
            <span className="text-xs text-gray-600 hidden sm:block">
              {typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'}+Enter to send
            </span>
            <button
              onClick={handleSend}
              disabled={isEmpty || sending}
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
              {sending ? 'Sending...' : isNote ? 'Add Note' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
      <div className="pb-4" />
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
