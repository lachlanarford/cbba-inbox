import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY
  return NextResponse.json({
    has_key: !!key,
    key_prefix: key ? key.slice(0, 12) + '...' : null,
    key_length: key?.length ?? 0,
  })
}
