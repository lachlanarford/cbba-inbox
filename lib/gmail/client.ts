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

export interface FetchMessagesResult {
  messages: ParsedEmail[]
  newHistoryId: string | null
}

export async function fetchMessagesFromHistory(
  channelConfigId: string,
  historyId: string,
  _email: string
): Promise<FetchMessagesResult> {
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

  return { messages, newHistoryId: historyRes.data.historyId ?? null }
}

export async function getCurrentHistoryId(channelConfigId: string): Promise<string> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  return profile.data.historyId ?? ''
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

  let body = extractBody(msg.payload)

  // Replace cid: references with inline base64 data URIs so images render in the iframe
  if (body.includes('cid:')) {
    const inlineImages = collectInlineImages(msg.payload)
    inlineImages.forEach(({ mimeType, data }, cid) => {
      body = body.replace(new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), `data:${mimeType};base64,${data}`)
    })
  }

  return { messageId, threadId, from: fromEmail, fromName, subject, body, internalDate }
}

type GmailPart = import('googleapis').gmail_v1.Schema$MessagePart

function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return ''
  return extractHtmlPart(payload) || extractPlainPart(payload) || ''
}

function extractHtmlPart(part: GmailPart): string {
  if (part.mimeType === 'text/html' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString('utf-8')
  }
  for (const child of part.parts ?? []) {
    const html = extractHtmlPart(child)
    if (html) return html
  }
  return ''
}

function extractPlainPart(part: GmailPart): string {
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString('utf-8')
  }
  for (const child of part.parts ?? []) {
    const plain = extractPlainPart(child)
    if (plain) return plain
  }
  return ''
}

function collectInlineImages(payload: GmailPart | undefined): Map<string, { mimeType: string; data: string }> {
  const map = new Map<string, { mimeType: string; data: string }>()
  if (!payload) return map
  function walk(part: GmailPart) {
    const headers = part.headers ?? []
    const contentId = headers.find((h) => h.name?.toLowerCase() === 'content-id')?.value
    if (contentId && part.body?.data && part.mimeType?.startsWith('image/')) {
      const cid = contentId.replace(/^<|>$/g, '')
      map.set(cid, { mimeType: part.mimeType, data: part.body.data })
    }
    for (const child of part.parts ?? []) walk(child)
  }
  walk(payload)
  return map
}

export async function sendReply(
  channelConfigId: string,
  opts: { threadId: string; to: string; from: string; subject: string; body: string }
): Promise<void> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })

  const subject = opts.subject.startsWith('Re:') ? opts.subject : `Re: ${opts.subject}`
  const isHtml = opts.body.trimStart().startsWith('<')
  const contentType = isHtml ? 'text/html' : 'text/plain'
  const raw = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${opts.threadId}`,
    `References: ${opts.threadId}`,
    `Content-Type: ${contentType}; charset=utf-8`,
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

export async function watchInbox(channelConfigId: string): Promise<string> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: process.env.GMAIL_PUBSUB_TOPIC ?? '',
      labelIds: ['INBOX'],
    },
  })
  return res.data.historyId ?? ''
}
