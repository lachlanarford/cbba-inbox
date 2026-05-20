'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import FilterBar from './FilterBar'
import ConversationList from './ConversationList'
import ConversationDetail from './ConversationDetail'
import NewConversationModal from './NewConversationModal'
import { DEFAULT_FILTERS, type InboxFilters } from '@/types/database'

const MIN_PANEL_WIDTH = 240
const MAX_PANEL_WIDTH = 560
const DEFAULT_PANEL_WIDTH = 320

export default function InboxLayout() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS)
  const [listWidth, setListWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [listCollapsed, setListCollapsed] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const updateFilter = useCallback(
    <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

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
    // Mark as read optimistically; the ConversationDetail also does this, belt-and-suspenders
    const supabase = createClient()
    await supabase
      .from('conversations')
      .update({ is_read: true })
      .eq('id', id)
      .eq('is_read', false)
  }

  return (
    <div className="flex h-full overflow-hidden -m-6">
      {/* Left panel */}
      {!listCollapsed && (
        <div
          className="flex-shrink-0 flex flex-col bg-cbba-navy-dark border-r border-white/5"
          style={{ width: listWidth }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
            <span className="text-sm font-semibold text-white">Conversations</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setListCollapsed(true)}
                title="Collapse panel"
                className="p-1 rounded text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cbba-purple text-white text-xs font-medium hover:bg-cbba-purple-light transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>
          </div>

          <FilterBar filters={filters} onFilterChange={updateFilter} onClearAll={clearFilters} />

          <ConversationList filters={filters} selectedId={selectedId} onSelect={handleSelect} />
        </div>
      )}

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
        {/* Expand list button when collapsed */}
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
