import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime } from '@/lib/utils/time'
import ChannelIcon from '@/components/ui/ChannelIcon'
import StatusBadge from '@/components/ui/StatusBadge'
import DepartmentBadge from '@/components/ui/DepartmentBadge'
import type { Contact, Conversation } from '@/types/database'

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!contact) notFound()

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', params.id)
    .order('last_message_at', { ascending: false })

  const c = contact as Contact
  const convs = (conversations ?? []) as Conversation[]

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back link */}
      <Link href="/contacts" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to contacts
      </Link>

      {/* Contact card */}
      <div className="bg-cbba-navy-light border border-white/5 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-white">{c.full_name ?? 'Unknown'}</h2>
            {c.email && <p className="text-sm text-gray-400">{c.email}</p>}
          </div>
          {c.channel && (
            <ChannelIcon channel={c.channel} className="w-5 h-5" showLabel />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-white/5">
          <div>
            <p className="text-xs text-gray-500 mb-1">Phone</p>
            <p className="text-sm text-gray-300">{c.phone ?? '-'}</p>
          </div>
          {c.social_id && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Social ID</p>
              <p className="text-sm text-gray-300 font-mono">{c.social_id}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Created</p>
            <p className="text-sm text-gray-300">{formatDate(c.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Last updated</p>
            <p className="text-sm text-gray-300">{formatDateTime(c.updated_at)}</p>
          </div>
        </div>
      </div>

      {/* Conversations */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Conversation history ({convs.length})
        </h3>
        {convs.length === 0 ? (
          <p className="text-sm text-gray-500">No conversations yet.</p>
        ) : (
          <div className="bg-cbba-navy-light border border-white/5 rounded-xl overflow-hidden">
            {convs.map((conv, idx) => (
              <div
                key={conv.id}
                className={`px-4 py-3 flex items-center gap-3 ${idx < convs.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                <ChannelIcon channel={conv.channel} className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{conv.subject ?? 'No subject'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(conv.last_message_at)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {conv.department && <DepartmentBadge department={conv.department} />}
                  <StatusBadge status={conv.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
