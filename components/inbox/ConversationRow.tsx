import type { ConversationListItem } from '@/types/database'
import { formatTimeAgo } from '@/lib/utils/time'
import ChannelIcon from '@/components/ui/ChannelIcon'
import DepartmentBadge from '@/components/ui/DepartmentBadge'
import PriorityBadge from '@/components/ui/PriorityBadge'

interface ConversationRowProps {
  conversation: ConversationListItem
  isSelected: boolean
  onClick: () => void
}

export default function ConversationRow({ conversation, isSelected, onClick }: ConversationRowProps) {
  const { contact, assigned_user, is_read, subject, channel, department, priority, last_message_at } = conversation

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-white/5 transition-colors duration-100 focus:outline-none ${
        isSelected
          ? 'bg-cbba-purple/20 border-l-2 border-l-cbba-purple'
          : 'hover:bg-white/5 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {/* Unread indicator */}
        <div className="flex-shrink-0 mt-1.5">
          {!is_read ? (
            <span className="block w-2 h-2 rounded-full bg-cbba-purple" />
          ) : (
            <span className="block w-2 h-2" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-sm truncate ${!is_read ? 'font-semibold text-white' : 'font-medium text-gray-300'}`}>
              {contact?.full_name ?? contact?.email ?? 'Unknown'}
            </span>
            <span className="text-xs text-gray-500 flex-shrink-0">{formatTimeAgo(last_message_at)}</span>
          </div>

          <p className={`text-xs truncate mb-1.5 ${!is_read ? 'text-gray-300' : 'text-gray-500'}`}>
            {subject ?? 'No subject'}
          </p>

          <div className="flex items-center gap-1.5 flex-wrap">
            <ChannelIcon channel={channel} className="w-3.5 h-3.5" />
            {department && <DepartmentBadge department={department} />}
            <PriorityBadge priority={priority} />
            {assigned_user && (
              <span className="ml-auto flex-shrink-0">
                {assigned_user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={assigned_user.avatar_url}
                    alt={assigned_user.full_name ?? ''}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-cbba-purple flex items-center justify-center text-[9px] font-semibold text-white">
                    {(assigned_user.full_name ?? '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
