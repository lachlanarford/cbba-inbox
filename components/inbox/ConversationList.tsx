'use client'

import { useConversations } from '@/lib/hooks/useConversations'
import ConversationRow from './ConversationRow'
import type { InboxFilters } from '@/types/database'

interface ConversationListProps {
  filters: InboxFilters
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function ConversationList({ filters, selectedId, onSelect }: ConversationListProps) {
  const { conversations, loading, error } = useConversations(filters)

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
          onClick={() => onSelect(conversation.id)}
        />
      ))}
    </div>
  )
}
