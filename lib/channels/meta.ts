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
        message: { text },
        messaging_type: 'RESPONSE',
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } }
    throw new Error(err.error?.message ?? 'Meta send failed')
  }
}
