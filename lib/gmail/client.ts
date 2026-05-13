import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
]

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/gmail/auth/callback`
  )
}

export function getAuthUrl(email: string): string {
  const oauth2 = createOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent',
    state: encodeURIComponent(email),
    login_hint: email,
  })
}

export interface GmailCredentials {
  access_token: string
  refresh_token: string
  expiry_date: number
  token_type: string
}

export async function getAuthenticatedClient(channelConfigId: string) {
  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from('channel_configs')
    .select('credentials')
    .eq('id', channelConfigId)
    .single()

  if (!config) throw new Error(`Channel config ${channelConfigId} not found`)

  const creds = config.credentials as unknown as GmailCredentials
  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.expiry_date,
    token_type: creds.token_type,
  })

  // Persist refreshed tokens back to channel_configs automatically
  oauth2.on('tokens', async (tokens) => {
    const updated: Partial<GmailCredentials> = {}
    if (tokens.access_token) updated.access_token = tokens.access_token
    if (tokens.expiry_date) updated.expiry_date = tokens.expiry_date
    await supabase
      .from('channel_configs')
      .update({ credentials: { ...creds, ...updated } })
      .eq('id', channelConfigId)
  })

  return oauth2
}

export interface ParsedEmail {
  messageId: string
  threadId: string
  from: string
  fromName: string | null
  subject: string
  body: string
  internalDate: string
}

export async function fetchMessagesFromHistory(
  channelConfigId: string,
  historyId: string,
  _email: string
): Promise<ParsedEmail[]> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })

  const historyRes = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: historyId,
    historyTypes: ['messageAdded'],
    labelId: 'INBOX',
  })

  const messages: ParsedEmail[] = []
  for (const record of historyRes.data.history ?? []) {
    for (const added of record.messagesAdded ?? []) {
      if (!added.message?.id) continue

      // Skip messages we sent (SENT label present)
      if (added.message.labelIds?.includes('SENT')) continue

      const full = await gmail.users.messages.get({
        userId: 'me',
        id: added.message.id,
        format: 'full',
      })

      const parsed = parseMessage(full.data)
      if (parsed) messages.push(parsed)
    }
  }

  return messages
}

function parseMessage(msg: import('googleapis').gmail_v1.Schema$Message): ParsedEmail | null {
  const headers = msg.payload?.headers ?? []
  const get = (name: string) => headers.find((h) => h.name?.toLowerCase() === name)?.value ?? ''

  const from = get('from')
  const subject = get('subject') || '(no subject)'
  const threadId = msg.threadId ?? ''
  const messageId = msg.id ?? ''
  const internalDate = msg.internalDate ?? ''

  const fromMatch = from.match(/^(?:"?([^"<]+)"?\s*)?<?([^>]+)>?$/)
  const fromName = fromMatch?.[1]?.trim() || null
  const fromEmail = fromMatch?.[2]?.trim() ?? from

  const body = extractBody(msg.payload)

  return { messageId, threadId, from: fromEmail, fromName, subject, body, internalDate }
}

function extractBody(payload: import('googleapis').gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part)
      if (text) return text
    }
  }

  return ''
}

export async function sendReply(
  channelConfigId: string,
  opts: { threadId: string; to: string; from: string; subject: string; body: string }
): Promise<void> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })

  const subject = opts.subject.startsWith('Re:') ? opts.subject : `Re: ${opts.subject}`
  const raw = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${opts.threadId}`,
    `References: ${opts.threadId}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    opts.body,
  ].join('\r\n')

  const encoded = Buffer.from(raw).toString('base64url')
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded, threadId: opts.threadId },
  })
}

export async function markAsRead(channelConfigId: string, messageId: string): Promise<void> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}

export async function watchInbox(channelConfigId: string): Promise<void> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: process.env.GMAIL_PUBSUB_TOPIC ?? '',
      labelIds: ['INBOX'],
    },
  })
}
