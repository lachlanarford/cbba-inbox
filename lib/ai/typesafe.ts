import { TypeSafeClient } from '@typesafe-ai/sdk'

let client: TypeSafeClient | null | undefined

/** Server-only client. Returns null when TYPESAFE_API_KEY is unset so callers can skip the judgment. */
export function getTypeSafeClient(): TypeSafeClient | null {
  if (client !== undefined) return client
  if (!process.env.TYPESAFE_API_KEY?.trim()) {
    client = null
    return null
  }
  client = new TypeSafeClient()
  return client
}
