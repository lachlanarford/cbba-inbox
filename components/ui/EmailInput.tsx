'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Suggestion {
  email: string
  name: string
}

interface EmailInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  // If true, value is a single email address (To field).
  // If false (default), value is comma-separated and autocomplete replaces the last token.
  single?: boolean
}

export default function EmailInput({ value, onChange, placeholder, className, autoFocus, single = false }: EmailInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The part of the value currently being typed (last token for multi, whole value for single)
  function getPartial(val: string): string {
    if (single) return val
    const parts = val.split(',')
    return parts[parts.length - 1].trim()
  }

  function replacePartial(val: string, replacement: string): string {
    if (single) return replacement
    const parts = val.split(',')
    parts[parts.length - 1] = ' ' + replacement
    return parts.join(',').replace(/^,\s*/, '') + ', '
  }

  const fetchSuggestions = useCallback((partial: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!partial || partial.length < 1) {
      setSuggestions([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/email-suggestions?q=${encodeURIComponent(partial)}`)
        if (res.ok) {
          const data = await res.json() as Suggestion[]
          setSuggestions(data)
          setOpen(data.length > 0)
          setActiveIndex(-1)
        }
      } catch {
        // silently ignore
      }
    }, 180)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val)
    fetchSuggestions(getPartial(val))
  }

  function selectSuggestion(s: Suggestion) {
    const replacement = s.name ? `${s.name} <${s.email}>` : s.email
    onChange(replacePartial(value, replacement))
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { const p = getPartial(value); if (p) fetchSuggestions(p) }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
        autoComplete="off"
        spellCheck={false}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-cbba-navy-dark border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.email}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s) }}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                i === activeIndex ? 'bg-cbba-purple/20' : 'hover:bg-white/5'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-400">
                {(s.name || s.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                {s.name && <p className="text-xs font-medium text-white truncate">{s.name}</p>}
                <p className="text-[11px] text-gray-500 truncate">{s.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
