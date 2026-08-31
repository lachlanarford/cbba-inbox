import { looksLikeHtml } from '@/lib/email/html'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function stripAttachmentMarker(content: string): string {
  return content.replace(/<!--CBBA_ATT:.+?-->\s*$/, '').trim()
}

export function parseAttachmentMarker(content: string): {
  msgId: string
  items: Array<{ id: string; name: string; mimeType: string; size: number }>
} | null {
  const match = content.match(/<!--CBBA_ATT:(.+?)-->\s*$/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1]) as {
      msgId: string
      items: Array<{ id: string; name: string; mimeType: string; size: number }>
    }
    if (!parsed.msgId || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

export function buildForwardQuote(opts: {
  subject: string
  from: string
  date: string
  to?: string | null
  body: string
}): string {
  const body = stripAttachmentMarker(opts.body)
  const dateStr = new Date(opts.date).toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const isHtml = looksLikeHtml(body)

  if (isHtml) {
    return `<p></p><div style="border-left:2px solid #ccc;padding-left:12px;margin-top:16px;color:#555;font-size:13px">
<p>---------- Forwarded message ---------<br>
<b>From:</b> ${escapeHtml(opts.from)}<br>
<b>Date:</b> ${escapeHtml(dateStr)}<br>
<b>Subject:</b> ${escapeHtml(opts.subject)}${opts.to ? `<br><b>To:</b> ${escapeHtml(opts.to)}` : ''}</p>
${body}
</div>`
  }

  return `\n\n---------- Forwarded message ---------\nFrom: ${opts.from}\nDate: ${dateStr}\nSubject: ${opts.subject}${opts.to ? `\nTo: ${opts.to}` : ''}\n\n${body}`
}
