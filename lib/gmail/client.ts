import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.readonly',
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

export interface AttachmentMeta {
  id: string
  name: string
  mimeType: string
  size: number
}

export interface ParsedEmail {
  messageId: string
  threadId: string
  from: string
  fromName: string | null
  subject: string
  body: string
  internalDate: string
  attachments: AttachmentMeta[]
  /** Other recipients (Cc + To except From) for Reply All */
  cc: string[]
}

export interface FetchHistoryResult {
  messages: ParsedEmail[]
  sentMessages: ParsedEmail[]
  closedThreadIds: string[]
  newHistoryId: string | null
}

export async function fetchMessagesFromHistory(
  channelConfigId: string,
  historyId: string,
  _email: string
): Promise<FetchHistoryResult> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })

  const historyRes = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: historyId,
    historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved'],
  })

  const messages: ParsedEmail[] = []
  const sentMessages: ParsedEmail[] = []
  const closedThreadIds = new Set<string>()

  for (const record of historyRes.data.history ?? []) {
    for (const added of record.messagesAdded ?? []) {
      if (!added.message?.id) continue
      const labels = added.message.labelIds ?? []
      const isInbox = labels.includes('INBOX')
      const isSent = labels.includes('SENT')

      if (!isInbox && !isSent) continue

      const full = await gmail.users.messages.get({
        userId: 'me',
        id: added.message.id,
        format: 'full',
      })
      const parsed = await parseMessage(gmail, full.data)
      if (!parsed) continue

      if (isInbox && !isSent) {
        messages.push(parsed)
      } else if (isSent && !isInbox) {
        // Outbound message sent from Gmail directly (not via app)
        sentMessages.push(parsed)
      }
      // isInbox && isSent = sent to self / CC'd self — treat as inbound
      if (isInbox && isSent) {
        messages.push(parsed)
      }
    }

    // INBOX label removed = archived or moved to a folder
    for (const removal of record.labelsRemoved ?? []) {
      if (removal.message?.threadId && removal.labelIds?.includes('INBOX')) {
        closedThreadIds.add(removal.message.threadId)
      }
    }

    // TRASH label added = moved to trash / deleted
    for (const addition of record.labelsAdded ?? []) {
      if (addition.message?.threadId && addition.labelIds?.includes('TRASH')) {
        closedThreadIds.add(addition.message.threadId)
      }
    }
  }

  // If a thread got a new message AND was archived in the same history window,
  // don't close it -- the new message should reopen it via processIncomingMessage
  for (const msg of messages) {
    closedThreadIds.delete(msg.threadId)
  }

  return {
    messages,
    sentMessages,
    closedThreadIds: Array.from(closedThreadIds),
    newHistoryId: historyRes.data.historyId ?? null,
  }
}

export async function getCurrentHistoryId(channelConfigId: string): Promise<string> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })
  const profile = await gmail.users.getProfile({ userId: 'me' })
  return profile.data.historyId ?? ''
}

async function parseMessage(
  gmail: ReturnType<typeof google.gmail>,
  msg: import('googleapis').gmail_v1.Schema$Message
): Promise<ParsedEmail | null> {
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
    // Small inline images: data is embedded directly in the message payload
    const inlineImages = collectInlineImages(msg.payload)
    inlineImages.forEach(({ mimeType, data }, cid) => {
      body = body.replace(new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), `data:${mimeType};base64,${data}`)
    })

    // Large inline images: Gmail stores them as separate attachments — fetch and embed
    const pendingInline = collectPendingInlineImages(msg.payload)
    for (const [cid, { mimeType, attachmentId }] of Array.from(pendingInline)) {
      try {
        const att = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachmentId,
        })
        if (att.data.data) {
          body = body.replace(
            new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
            `data:${mimeType};base64,${att.data.data}`
          )
        }
      } catch {
        // leave the cid: reference as-is if fetch fails
      }
    }
  }

  const attachments = extractAttachments(msg.payload)
  if (attachments.length > 0) {
    body = body + `<!--CBBA_ATT:${JSON.stringify({ msgId: messageId, items: attachments })}-->`
  }

  const fromEmailNorm = fromEmail.trim().toLowerCase()
  const parseAddressList = (raw: string): string[] => {
    if (!raw) return []
    return raw.split(',').map((addr) => {
      const m = addr.match(/<([^>]+)>/)
      return (m ? m[1] : addr).trim().toLowerCase()
    }).filter(Boolean)
  }

  // Reply All recipients = everyone on To/Cc except the sender (From)
  // Our own inbox address is filtered later when composing using the From account
  const toAddrs = parseAddressList(get('to'))
  const ccAddrs = parseAddressList(get('cc'))
  const cc = Array.from(new Set([...toAddrs, ...ccAddrs]))
    .filter((addr) => addr !== fromEmailNorm)

  return { messageId, threadId, from: fromEmail, fromName, subject, body, internalDate, attachments, cc }
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

function extractAttachments(payload: GmailPart | undefined): AttachmentMeta[] {
  const attachments: AttachmentMeta[] = []
  if (!payload) return attachments
  function walk(part: GmailPart) {
    const headers = part.headers ?? []
    const contentId = headers.find((h) => h.name?.toLowerCase() === 'content-id')?.value
    // Only skip parts that are inline images (image/* with content-id, no filename).
    // Outlook and some clients add Content-ID to all attachments including spreadsheets --
    // check for a real filename before skipping so those are not silently dropped.
    if (contentId && part.mimeType?.startsWith('image/') && !part.filename) return
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        name: part.filename,
        mimeType: part.mimeType ?? 'application/octet-stream',
        size: part.body.size ?? 0,
      })
      return // don't walk children of a leaf attachment part
    }
    for (const child of part.parts ?? []) walk(child)
  }
  walk(payload)
  return attachments
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

// Large inline images: Gmail stores them as attachments (attachmentId) rather than embedding data
function collectPendingInlineImages(payload: GmailPart | undefined): Map<string, { mimeType: string; attachmentId: string }> {
  const map = new Map<string, { mimeType: string; attachmentId: string }>()
  if (!payload) return map
  function walk(part: GmailPart) {
    const headers = part.headers ?? []
    const contentId = headers.find((h) => h.name?.toLowerCase() === 'content-id')?.value
    if (contentId && !part.body?.data && part.body?.attachmentId && part.mimeType?.startsWith('image/')) {
      const cid = contentId.replace(/^<|>$/g, '')
      map.set(cid, { mimeType: part.mimeType, attachmentId: part.body.attachmentId })
    }
    for (const child of part.parts ?? []) walk(child)
  }
  walk(payload)
  return map
}

export interface OutboundAttachment {
  name: string
  mimeType: string
  data: string // base64-encoded file data
}

// RFC 2045 requires base64 lines to be at most 76 chars in MIME bodies
function chunkBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join('\r\n') ?? b64
}

export async function sendReply(
  channelConfigId: string,
  opts: { threadId: string; to: string; from: string; subject: string; body: string; attachments?: OutboundAttachment[]; cc?: string[]; bcc?: string[] }
): Promise<void> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })

  const subject = opts.subject.startsWith('Re:') ? opts.subject : `Re: ${opts.subject}`
  const isHtml = opts.body.trimStart().startsWith('<')
  const bodyContentType = isHtml ? 'text/html' : 'text/plain'

  let raw: string

  const ccHeaders = opts.cc && opts.cc.length > 0 ? [`Cc: ${opts.cc.join(', ')}`] : []
  const bccHeaders = opts.bcc && opts.bcc.length > 0 ? [`Bcc: ${opts.bcc.join(', ')}`] : []

  if (opts.attachments && opts.attachments.length > 0) {
    const boundary = `cbba_${Date.now()}`
    const parts: string[] = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      ...ccHeaders,
      ...bccHeaders,
      `Subject: ${subject}`,
      `In-Reply-To: ${opts.threadId}`,
      `References: ${opts.threadId}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: ${bodyContentType}; charset=utf-8`,
      '',
      opts.body,
    ]
    for (const att of opts.attachments) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.name}"`,
        `Content-Disposition: attachment; filename="${att.name}"`,
        `Content-Transfer-Encoding: base64`,
        '',
        chunkBase64(att.data),
      )
    }
    parts.push(`--${boundary}--`)
    raw = parts.join('\r\n')
  } else {
    raw = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      ...ccHeaders,
      ...bccHeaders,
      `Subject: ${subject}`,
      `In-Reply-To: ${opts.threadId}`,
      `References: ${opts.threadId}`,
      `Content-Type: ${bodyContentType}; charset=utf-8`,
      'MIME-Version: 1.0',
      '',
      opts.body,
    ].join('\r\n')
  }

  const encoded = Buffer.from(raw).toString('base64url')
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded, threadId: opts.threadId },
  })
}

// Returns { threadId, messageId } of the newly created Gmail thread
export async function sendNewEmail(
  channelConfigId: string,
  opts: { to: string; from: string; subject: string; body: string; bcc?: string[] }
): Promise<{ threadId: string; messageId: string }> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })

  const isHtml = opts.body.trimStart().startsWith('<')
  const bodyContentType = isHtml ? 'text/html' : 'text/plain'
  const bccHeaders = opts.bcc && opts.bcc.length > 0 ? [`Bcc: ${opts.bcc.join(', ')}`] : []

  const raw = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...bccHeaders,
    `Subject: ${opts.subject}`,
    `Content-Type: ${bodyContentType}; charset=utf-8`,
    'MIME-Version: 1.0',
    '',
    opts.body,
  ].join('\r\n')

  const encoded = Buffer.from(raw).toString('base64url')
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  })

  return {
    threadId: res.data.threadId ?? res.data.id ?? '',
    messageId: res.data.id ?? '',
  }
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

export async function markThreadAsUnread(channelConfigId: string, threadId: string): Promise<void> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })
  await gmail.users.threads.modify({
    userId: 'me',
    id: threadId,
    requestBody: { addLabelIds: ['UNREAD'] },
  })
}

export async function watchInbox(channelConfigId: string): Promise<string> {
  const auth = await getAuthenticatedClient(channelConfigId)
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: process.env.GMAIL_PUBSUB_TOPIC ?? '',
      labelIds: ['INBOX', 'SENT'],
    },
  })
  return res.data.historyId ?? ''
}
