// Facebook Messenger -- credentials required before activation

export async function sendMessage(
  recipientId: string,
  text: string,
  pageAccessToken: string
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    }
  )

  if (!res.ok) {
    const data = await res.json()
    throw new Error(`Facebook API error: ${JSON.stringify(data)}`)
  }
}
