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
  const { contact, assigned_user, is_read, needs_review, subject, channel, department, priority, last_message_at, has_attachments, snoozed_until } = conversation
  const isSnoozed = snoozed_until != null && new Date(snoozed_until) > new Date()

  return (
    <div
      className={`group relative w-full text-left border-b border-white/5 transition-[background-color] duration-100 ease-out cursor-pointer ${
        isSelected
          ? 'bg-cbba-purple/20 border-l-2 border-l-cbba-purple'
          : !is_read
          ? '[@media(hover:hover)]:hover:bg-white/5 border-l-2 border-l-cbba-purple/60'
          : '[@media(hover:hover)]:hover:bg-white/5 border-l-2 border-l-transparent'
      } ${isChecked ? 'bg-cbba-purple/10' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2.5 min-w-0 px-3 py-3">
        {/* Checkbox / unread dot */}
        <div
          className="flex-shrink-0 mt-1 w-4 h-4 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onCheck() }}
        >
          {/* Always show checkbox on touch; on desktop show on hover or when selecting */}
          <span className={`${hasAnyChecked ? 'flex' : 'hidden max-md:flex group-hover:flex'} w-4 h-4 items-center justify-center rounded border transition-[background-color,border-color] duration-100 ease-out ${
            isChecked
              ? 'bg-cbba-purple border-cbba-purple'
              : 'border-gray-500 [@media(hover:hover)]:hover:border-white bg-transparent'
          }`}>
            {isChecked && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          {/* Unread dot — desktop only when not hovering / selecting */}
          {!is_read ? (
            <span className={`${hasAnyChecked ? 'hidden' : 'hidden max-md:hidden group-hover:hidden'} w-2.5 h-2.5 rounded-full bg-cbba-purple ring-2 ring-cbba-purple/25`} />
          ) : (
            <span className={`${hasAnyChecked ? 'hidden' : 'hidden max-md:hidden group-hover:hidden'} w-2.5 h-2.5`} />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-sm truncate tracking-tight leading-tight ${!is_read ? 'font-semibold text-white' : 'font-medium text-gray-200'}`}>
              {contact?.full_name ?? contact?.email ?? 'Unknown'}
            </span>
            <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums tracking-tight">{formatTimeAgo(last_message_at)}</span>
          </div>

          <p className={`text-xs truncate mb-1.5 leading-snug tracking-tight ${!is_read ? 'text-gray-300' : 'text-gray-400'}`}>
            {subject ?? 'No subject'}
          </p>

          <div className="flex items-center gap-1.5 flex-wrap">
            <ChannelIcon channel={channel} className="w-3.5 h-3.5" />
            {department && <DepartmentBadge department={department} />}
            <PriorityBadge priority={priority} />
            {has_attachments && (
              <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
            )}
            {isSnoozed && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                Snoozed
              </span>
            )}
            {needs_review && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none bg-amber-500/15 text-amber-400 border border-amber-500/20">
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
