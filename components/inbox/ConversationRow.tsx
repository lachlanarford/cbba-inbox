import type { ConversationListItem } from '@/types/database'
import { formatTimeAgo } from '@/lib/utils/time'
import ChannelIcon from '@/components/ui/ChannelIcon'
import DepartmentBadge from '@/components/ui/DepartmentBadge'
import PriorityBadge from '@/components/ui/PriorityBadge'

interface ConversationRowProps {
  conversation: ConversationListItem
  isSelected: boolean
  isChecked: boolean
  hasAnyChecked: boolean
  onClick: () => void
  onCheck: () => void
}

export default function ConversationRow({
  conversation,
  isSelected,
  isChecked,
  hasAnyChecked,
  onClick,
  onCheck,
}: ConversationRowProps) {
  const { contact, assigned_user, is_read, needs_review, subject, channel, department, priority, last_message_at } = conversation

  return (
    <div
      className={`group relative w-full text-left border-b border-white/5 transition-colors duration-100 cursor-pointer ${
        isSelected
          ? 'bg-cbba-purple/20 border-l-2 border-l-cbba-purple'
          : !is_read
          ? 'hover:bg-white/5 border-l-2 border-l-cbba-purple/60'
          : 'hover:bg-white/5 border-l-2 border-l-transparent'
      } ${isChecked ? 'bg-cbba-purple/10' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2.5 min-w-0 px-3 py-3">
        {/* Checkbox / unread dot */}
        <div
          className="flex-shrink-0 mt-1 w-4 h-4 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onCheck() }}
        >
          {/* Show checkbox on hover or when any are checked */}
          <span className={`${hasAnyChecked ? 'flex' : 'hidden group-hover:flex'} w-4 h-4 items-center justify-center rounded border transition-colors ${
            isChecked
              ? 'bg-cbba-purple border-cbba-purple'
              : 'border-gray-500 hover:border-white bg-transparent'
          }`}>
            {isChecked && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          {/* Unread dot — shown when not hovering and no items selected */}
          {!is_read ? (
            <span className={`${hasAnyChecked ? 'hidden' : 'block group-hover:hidden'} w-2.5 h-2.5 rounded-full bg-cbba-purple ring-2 ring-cbba-purple/25`} />
          ) : (
            <span className={`${hasAnyChecked ? 'hidden' : 'block group-hover:hidden'} w-2.5 h-2.5`} />
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
            {needs_review && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                Review
              </span>
            )}
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
    </div>
  )
}
