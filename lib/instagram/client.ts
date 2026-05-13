// Instagram Messaging -- credentials required before activation

export async function sendMessage(
  recipientId: string,
  text: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`,
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
    throw new Error(`Instagram API error: ${JSON.stringify(data)}`)
  }
}
