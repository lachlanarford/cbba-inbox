// Fire-and-forget helper called from webhook handlers after a new conversation is created.
// Does not block the webhook response.
export function triggerCategorise(conversationId: string, content: string, subject?: string | null) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  fetch(`${appUrl}/api/ai/categorise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, content, subject: subject ?? undefined }),
  }).catch((err) => console.error('[categorise] fire-and-forget error:', err))
}
