import { looksLikeHtml } from '@/lib/email/html'
import { stripAttachmentMarker } from '@/lib/email/forward-quote'

const MAX_HISTORY_MESSAGES = 25
const MAX_HISTORY_CHARS = 400_000

export interface HistoryMessage {
  content: string
  fromName: string | null
  fromAddress: string | null
  createdAt: string
  to?: string | null
  cc?: string[] | null
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatAuDate(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatSender(message: HistoryMessage): string {
  if (message.fromName && message.fromAddress) {
    return `${message.fromName} <${message.fromAddress}>`
  }
  return message.fromAddress || message.fromName || 'Unknown'
}

/** Pull email addresses out of a To/Cc/Bcc field that may include display names. */
export function extractEmails(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  const emails: string[] = []
  for (const part of raw.split(',')) {
    const angle = part.match(/<([^>]+)>/)
    const candidate = (angle ? angle[1] : part).trim().toLowerCase()
    if (candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
      emails.push(candidate)
    }
  }
  return emails
}

/**
 * Drop nested quoted history and huge inline images so reconstructed threads
 * do not duplicate Gmail quotes or explode MIME size.
 */
export function stripQuotedHistory(content: string, opts?: { keepImages?: boolean }): string {
  let body = stripAttachmentMarker(content)
  if (!opts?.keepImages) {
    body = body.replace(/<img\b[^>]*src=["']data:[^"']*["'][^>]*>/gi, '[image]')
    body = body.replace(/\s*src=(["'])data:[^"']*\1/gi, '')
  }

  if (looksLikeHtml(body)) {
    body = body.replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[\s\S]*$/i, '')
    body = body.replace(/<blockquote[^>]*class="[^"]*gmail_quote[^"]*"[\s\S]*$/i, '')
    body = body.replace(/<div[^>]*id="divRplyFwdMsg"[\s\S]*$/i, '')
    body = body.replace(/<hr[^>]*>\s*<b>From:<\/b>[\s\S]*$/i, '')
    return body.trim()
  }

  const cut = body.search(/\n(?:-----Original Message-----|On .+ wrote:)/)
  if (cut !== -1) return body.slice(0, cut).trim()
  return body.trim()
}

function toHtmlFragment(content: string): string {
  const cleaned = stripQuotedHistory(content)
  if (!cleaned) return ''
  if (looksLikeHtml(cleaned)) return cleaned
  return escapeHtml(cleaned).replace(/\n/g, '<br>\n')
}

function quoteBlock(message: HistoryMessage, inner: string): string {
  const bodyHtml = toHtmlFragment(message.content)
  if (!bodyHtml && !inner) return inner

  const extra: string[] = []
  if (message.to) extra.push(`<b>To:</b> ${escapeHtml(message.to)}`)
  if (message.cc && message.cc.length > 0) {
    extra.push(`<b>Cc:</b> ${escapeHtml(message.cc.join(', '))}`)
  }
  const extraHtml = extra.length > 0 ? `<br>${extra.join('<br>')}` : ''

  return `<div class="gmail_quote"><div class="gmail_attr">On ${escapeHtml(formatAuDate(message.createdAt))}, ${escapeHtml(formatSender(message))} wrote:${extraHtml}</div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${bodyHtml}${inner}</blockquote></div>`
}

function renderHistory(messages: HistoryMessage[]): string {
  return messages.reduce((inner, message) => quoteBlock(message, inner), '')
}

/** Gmail-style nested quotes of prior messages, oldest innermost. */
export function buildReplyHistoryHtml(messages: HistoryMessage[]): string {
  const usable = messages.filter((m) => stripQuotedHistory(m.content) || (m.cc && m.cc.length > 0))
  if (usable.length === 0) return ''

  let slice = usable.slice(-MAX_HISTORY_MESSAGES)
  let html = renderHistory(slice)
  while (html.length > MAX_HISTORY_CHARS && slice.length > 1) {
    slice = slice.slice(1)
    html = renderHistory(slice)
  }
  return html
}

export function appendReplyHistory(replyBody: string, historyHtml: string): string {
  if (!historyHtml) return replyBody
  if (looksLikeHtml(replyBody)) return `${replyBody}${historyHtml}`
  const replyHtml = escapeHtml(replyBody).replace(/\n/g, '<br>\n')
  return `${replyHtml}${historyHtml}`
}
