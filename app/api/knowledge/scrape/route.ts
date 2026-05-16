import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url } = body as { url: string }
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    const res = await fetch(url, {
      headers: { 'User-Agent': 'CBBA-Inbox-Bot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: HTTP ${res.status}` }, { status: 422 })

    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = (titleMatch?.[1] ?? url).trim()

    // Strip tags naively
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 8000)

    return NextResponse.json({ chunks_saved: 1, title, preview: text.slice(0, 100) })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
