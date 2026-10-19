import { createServiceClient } from '@/lib/supabase/service'
import { sendNewEmail } from '@/lib/gmail/client'

function plainText(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

export async function emailMentionedUsers(opts: {
  userIds: string[]
  authorName: string
  conversationId: string
  subject: string | null
  excerpt: string
}): Promise<void> {
  if (opts.userIds.length === 0) return

  const supabase = createServiceClient()
  const { data: conversation } = await supabase
    .from('conversations')
    .select('channel_config_id')
    .eq('id', opts.conversationId)
    .maybeSingle()

  const { data: preferred } = conversation?.channel_config_id
    ? await supabase
        .from('channel_configs')
        .select('id, identifier')
        .eq('id', conversation.channel_config_id)
        .eq('channel_type', 'gmail')
        .eq('is_active', true)
        .maybeSingle()
    : { data: null }

  const { data: fallback } = preferred
    ? { data: null }
    : await supabase
        .from('channel_configs')
        .select('id, identifier')
        .eq('channel_type', 'gmail')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

  const mailbox = preferred ?? fallback

  if (!mailbox) {
    console.error('[mention] no active Gmail channel for mention email')
    return
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .in('id', opts.userIds)
    .eq('is_active', true)

  const recipients = (users ?? [])
    .map((user) => user.email?.trim())
    .filter((email): email is string => !!email)

  if (recipients.length === 0) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cbba-inbox.vercel.app'
  const topic = headerSafe(opts.subject?.trim() || 'a conversation')
  const excerpt = plainText(opts.excerpt).slice(0, 500)
  const link = `${appUrl}/inbox?conversation=${opts.conversationId}`
  const body = [
    `${opts.authorName} mentioned you in an internal note on ${topic}.`,
    '',
    excerpt || '(empty note)',
    '',
    `Open it in CBBA Inbox: ${link}`,
  ].join('\n')

  await Promise.all(recipients.map(async (to) => {
    try {
      await sendNewEmail(mailbox.id, {
        to,
        from: mailbox.identifier,
        subject: headerSafe(`Mentioned in a note: ${topic}`),
        body,
      })
    } catch (err) {
      console.error('[mention] email failed for', to, err)
    }
  }))
}
