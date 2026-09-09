import { looksLikeHtml } from '@/lib/email/html'
import { parseAttachmentMarker } from '@/lib/email/forward-quote'
import { stripQuotedHistory } from '@/lib/email/reply-history'

export function sanitizeEmailHtmlForPrint(html: string): string {
  let out = html
  const bodyMatch = out.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) out = bodyMatch[1]
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  out = out.replace(/<object[\s\S]*?<\/object>/gi, '')
  out = out.replace(/<embed[\s\S]*?>/gi, '')
  out = out.replace(/<link[^>]*>/gi, '')
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '')
  out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
  out = out.replace(/javascript:/gi, '')
  return out.trim()
}

export function printMessageBodyHtml(content: string): { html: string | null; text: string | null; attachments: string[] } {
  const marker = parseAttachmentMarker(content)
  const attachments = marker?.items.map((item) => item.name) ?? []
  const cleaned = stripQuotedHistory(content, { keepImages: true })
  if (!cleaned) return { html: null, text: null, attachments }
  if (looksLikeHtml(cleaned)) {
    return { html: sanitizeEmailHtmlForPrint(cleaned), text: null, attachments }
  }
  return { html: null, text: cleaned, attachments }
}

export function formatPrintDate(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function channelLabel(channel: string): string {
  switch (channel) {
    case 'gmail': return 'Email'
    case 'whatsapp': return 'WhatsApp'
    case 'facebook': return 'Facebook'
    case 'instagram': return 'Instagram'
    case 'form': return 'Form'
    case 'chat': return 'Live chat'
    default: return channel
  }
}
