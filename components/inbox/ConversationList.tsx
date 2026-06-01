'use client'

import { useConversations } from '@/lib/hooks/useConversations'
import ConversationRow from './ConversationRow'
import type { InboxFilters } from '@/types/database'

interface ConversationListProps {
  filters: InboxFilters
  selectedId: string | null
  checkedIds: Set<string>
  onSelect: (id: string) => void
  onCheck: (id: string) => void
}

export default function ConversationList({
  filters,
  selectedId,
  checkedIds,
  onSelect,
  onCheck,
}: ConversationListProps) {
  const { conversations, loading, loadingMore, error, hasMore, loadMore } = useConversations(filters)
  const hasAnyChecked = checkedIds.size > 0

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-2 w-full px-3 pt-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-1">
          <p className="text-sm text-red-400">Failed to load conversations</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-1">
          <p className="text-sm text-gray-400">No conversations found</p>
          <p className="text-xs text-gray-600">Try adjusting your filters</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          isSelected={selectedId === conversation.id}
          isChecked={checkedIds.has(conversation.id)}
          hasAnyChecked={hasAnyChecked}
          onClick={() => onSelect(conversation.id)}
          onCheck={() => onCheck(conversation.id)}
        />
      ))}
      {hasMore && (
        <div className="py-3 px-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 transition-colors"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
