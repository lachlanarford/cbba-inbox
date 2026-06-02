function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function getMetaUserName(psid: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${psid}?fields=name&access_token=${encodeURIComponent(accessToken)}`
    )
    const data = await res.json() as { name?: string; error?: { message?: string; code?: number } }
    if (!res.ok) {
      console.error('[getMetaUserName] API error for PSID', psid, data.error)
      return null
    }
    console.log('[getMetaUserName] PSID', psid, '-> name:', data.name ?? null)
    return data.name ?? null
  } catch (err) {
    console.error('[getMetaUserName] fetch failed:', err)
    return null
  }
}

export async function sendMetaMessage({
  recipientId,
  text,
  accessToken,
}: {
  recipientId: string
  text: string
  accessToken: string
}): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/me/messages?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: htmlToPlainText(text) },
        messaging_type: 'RESPONSE',
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } }
    throw new Error(err.error?.message ?? 'Meta send failed')
  }
}
