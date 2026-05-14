'use client'

import { useState, useRef, useCallback } from 'react'

interface ReplyBoxProps {
  conversationId: string
}

export default function ReplyBox({ conversationId }: ReplyBoxProps) {
  const [content, setContent] = useState('')
  const [isNote, setIsNote] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [aiSuggested, setAiSuggested] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const MAX_CHARS = 5000

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || sending) return

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
    textareaRef.current?.focus()
  }, [content, conversationId, isNote, sending, aiSuggested])

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    if (aiSuggested) setAiSuggested(false)
  }

  const remaining = MAX_CHARS - content.length
  const isOverLimit = remaining < 0

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
      </div>

      {/* Textarea */}
      <div className={`mx-4 mt-0 rounded-b-lg border ${isNote ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/10 bg-cbba-navy-light'}`}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={isNote ? 'Add an internal note...' : 'Type your reply...'}
          rows={4}
          className="w-full px-3 pt-3 bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-3">
            <span className={`text-xs ${isOverLimit ? 'text-red-400' : remaining < 100 ? 'text-amber-400' : 'text-gray-600'}`}>
              {remaining.toLocaleString()} chars remaining
            </span>
            {aiSuggested && (
              <span className="flex items-center gap-1 text-xs text-purple-400">
                <SparkleIcon className="w-3 h-3" />
                AI suggested
              </span>
            )}
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
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
              disabled={!content.trim() || sending || isOverLimit}
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
