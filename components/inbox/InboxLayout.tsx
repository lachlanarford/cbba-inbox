'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUsers } from '@/lib/hooks/useUsers'
import { useAppUser } from '@/contexts/AppUserContext'
import FilterBar from './FilterBar'
import ConversationList from './ConversationList'
import { snoozeUntil, type SnoozePreset } from '@/lib/utils/snooze'
import ConversationDetail from './ConversationDetail'
import NewConversationModal from './NewConversationModal'
import { DEFAULT_FILTERS, type InboxFilters } from '@/types/database'

const MIN_PANEL_WIDTH = 240
const MAX_PANEL_WIDTH = 560
const DEFAULT_PANEL_WIDTH = 320

const STATUSES  = ['open', 'closed']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export default function InboxLayout() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS)
  const [listWidth, setListWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const users = useUsers()
  const currentUser = useAppUser()
  const searchParams = useSearchParams()

  // Open conversation from push notification deep link (?conversation=id)
  useEffect(() => {
    const id = searchParams.get('conversation')
    if (id) setSelectedId(id)
  }, [searchParams])

  const updateFilter = useCallback(
    <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const setInboxView = useCallback((view: 'mine' | 'all') => {
    if (view === 'mine') {
      setFilters((prev) => ({
        ...prev,
        myInbox: true,
        assignedTo: currentUser.id,
      }))
    } else {
      setFilters((prev) => ({
        ...prev,
        myInbox: false,
        assignedTo: prev.myInbox ? '' : prev.assignedTo,
      }))
    }
  }, [currentUser.id])

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearChecked() {
    setCheckedIds(new Set())
  }

  async function handleBulkAction(action: string, value?: string) {
    if (!checkedIds.size) return
    setBulkLoading(true)
    setBulkError(null)
    try {
      const res = await fetch('/api/conversations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(checkedIds), action, value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setBulkError(data.error ?? 'Bulk action failed')
        return
      }
      if (action === 'delete' && selectedId && checkedIds.has(selectedId)) {
        setSelectedId(null)
      }
      clearChecked()
    } finally {
      setBulkLoading(false)
    }
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: listWidth }
    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return
      const delta = ev.clientX - dragRef.current.startX
      setListWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, dragRef.current.startWidth + delta)))
    }
    function onMouseUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  async function handleSelect(id: string) {
    setSelectedId(id)
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ is_read: true })
      .eq('id', id)
      .eq('is_read', false)
  }

  const hasChecked = checkedIds.size > 0

  function getSnoozeIso(preset: string): string {
    return snoozeUntil(preset as SnoozePreset).toISOString()
  }

  const activeFilterCount = [
    filters.status !== 'open',
    filters.myInbox,
    filters.search !== '',
    filters.email !== '',
    filters.department !== '',
    filters.priority !== '',
    filters.channel !== '',
    filters.channelConfigId !== '',
    filters.assignedTo !== '',
    filters.dateFrom !== '',
    filters.dateTo !== '',
  ].filter(Boolean).length

  // Shared conversation list panel content
  const listPanel = (
    <div
      className="flex-shrink-0 flex flex-col overflow-hidden bg-cbba-navy-dark border-r border-white/5"
      style={isMobile ? undefined : { width: listWidth }}
    >
      {/* Panel header / Bulk action bar */}
      {hasChecked ? (
        <div className="flex flex-col border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2.5 flex-wrap">
          <button
            onClick={clearChecked}
            className="p-1 rounded text-gray-500 hover:text-white transition-colors flex-shrink-0"
            title="Clear selection"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-xs text-gray-400 font-medium flex-shrink-0">{checkedIds.size} selected</span>

          {/* Status */}
          <select
            disabled={bulkLoading}
            onChange={(e) => { if (e.target.value) { handleBulkAction('status', e.target.value); e.target.value = '' } }}
            defaultValue=""
            className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-400 focus:outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="" disabled>Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>

          {/* Priority */}
          <select
            disabled={bulkLoading}
            onChange={(e) => { if (e.target.value) { handleBulkAction('priority', e.target.value); e.target.value = '' } }}
            defaultValue=""
            className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-400 focus:outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="" disabled>Priority</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Assign */}
          <select
            disabled={bulkLoading}
            onChange={(e) => { handleBulkAction('assign', e.target.value || undefined); e.target.value = '' }}
            defaultValue=""
            className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-400 focus:outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="" disabled>Assign</option>
            <option value="">Unassign</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>)}
          </select>

          {/* Snooze */}
          <select
            disabled={bulkLoading}
            onChange={(e) => {
              if (!e.target.value) return
              const until = getSnoozeIso(e.target.value)
              handleBulkAction('snooze', until)
              e.target.value = ''
            }}
            defaultValue=""
            className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-gray-400 focus:outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="" disabled>Snooze</option>
            <option value="1h">1 hour</option>
            <option value="later">Later today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="week">Next week</option>
          </select>

          {/* Unsnooze (only useful in snoozed view) */}
          {filters.showSnoozed && (
            <button
              disabled={bulkLoading}
              onClick={() => handleBulkAction('unsnooze')}
              title="Unsnooze selected"
              className="p-1.5 rounded text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </button>
          )}

          {/* Archive */}
          <button
            disabled={bulkLoading}
            onClick={() => handleBulkAction('archive')}
            title="Archive selected"
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1zM5 10v8a1 1 0 001 1h12a1 1 0 001-1v-8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14h4" />
            </svg>
          </button>

          {/* Delete */}
          <button
            disabled={bulkLoading}
            onClick={() => {
              if (confirm(`Delete ${checkedIds.size} conversation${checkedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) {
                handleBulkAction('delete')
              }
            }}
            title="Delete selected"
            className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          </div>
          {bulkError && (
            <p className="px-3 pb-2 text-xs text-red-400">{bulkError}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              {filters.showSnoozed ? 'Snoozed' : filters.myInbox ? 'My Inbox' : 'Conversations'}
            </span>
            <button
              onClick={() => {
                updateFilter('showSnoozed', !filters.showSnoozed)
                if (!filters.showSnoozed) updateFilter('status', 'all')
                else updateFilter('status', 'open')
                clearChecked()
              }}
              title={filters.showSnoozed ? 'Back to inbox' : 'View snoozed'}
              className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium active:scale-[0.97] transition-[color,background-color,border-color,transform] duration-150 ease-out ${
                filters.showSnoozed
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-gray-500 [@media(hover:hover)]:hover:text-gray-300 [@media(hover:hover)]:hover:bg-white/5'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {filters.showSnoozed ? 'Back' : 'Snoozed'}
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isMobile && (
              <button
                onClick={() => setListCollapsed(true)}
                title="Collapse panel"
                className="p-1 rounded text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              title={filtersOpen ? 'Hide filters' : 'Show filters'}
              className={`relative p-1 rounded active:scale-[0.97] transition-[color,background-color,transform] duration-150 ease-out ${
                filtersOpen ? 'text-white bg-white/10' : 'text-gray-500 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/5'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M9 16h6" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-cbba-purple text-[9px] font-bold text-white leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cbba-purple text-white text-xs font-medium [@media(hover:hover)]:hover:bg-cbba-purple-light active:scale-[0.97] transition-[background-color,transform] duration-150 ease-out"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          </div>
        </div>
      )}

      <FilterBar
        filters={filters}
        onFilterChange={updateFilter}
        onClearAll={clearFilters}
        filtersOpen={filtersOpen}
        onInboxViewChange={setInboxView}
      />

      <ConversationList
        filters={filters}
        selectedId={selectedId}
        checkedIds={checkedIds}
        onSelect={handleSelect}
        onCheck={toggleCheck}
      />
    </div>
  )

  if (isMobile) {
    return (
      <div className="absolute inset-0 flex overflow-hidden">
        {selectedId ? (
          <div className="flex-1 min-w-0 overflow-hidden relative">
            <ConversationDetail
              conversationId={selectedId}
              sidebarOpen={false}
              onToggleSidebar={() => {}}
              onDeleted={() => setSelectedId(null)}
              onBack={() => setSelectedId(null)}
              onSelectConversation={setSelectedId}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {listPanel}
          </div>
        )}

        {showModal && (
          <NewConversationModal
            onClose={() => setShowModal(false)}
            onCreated={(id) => {
              setShowModal(false)
              setSelectedId(id)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* Left panel */}
      {!listCollapsed && listPanel}

      {/* Drag handle */}
      {!listCollapsed && (
        <div
          onMouseDown={startResize}
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-cbba-purple/60 transition-colors active:bg-cbba-purple"
          title="Drag to resize"
        />
      )}

      {/* Right panel */}
      <div className="flex-1 min-w-0 overflow-hidden relative">
        {listCollapsed && (
          <button
            onClick={() => setListCollapsed(false)}
            title="Show conversation list"
            className="absolute top-3 left-3 z-10 p-1.5 rounded-lg bg-cbba-navy-dark border border-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {selectedId ? (
          <ConversationDetail
            conversationId={selectedId}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            onDeleted={() => setSelectedId(null)}
            onSelectConversation={setSelectedId}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center space-y-2">
              <svg className="w-10 h-10 mx-auto text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
              </svg>
              <p className="text-sm">Select a conversation to view</p>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewConversationModal
          onClose={() => setShowModal(false)}
          onCreated={(id) => {
            setShowModal(false)
            setSelectedId(id)
          }}
        />
      )}
    </div>
  )
}
