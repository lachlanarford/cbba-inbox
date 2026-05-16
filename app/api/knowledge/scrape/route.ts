import { NextResponse } from 'next/server'

async function scrapeUrl(url: string): Promise<{ title: string; chunks: string[] }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CBBA-Inbox-Bot/1.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  const titleMatch = stripped.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : url

  const text = stripped
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

  const CHUNK_SIZE = 1000
  const CHUNK_OVERLAP = 100
  const chunks: string[] = []
  if (text.length <= CHUNK_SIZE) {
    if (text) chunks.push(text)
  } else {
    let start = 0
    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE, text.length)
      chunks.push(text.slice(start, end))
      start = end - CHUNK_OVERLAP
      if (start >= text.length) break
    }
  }

  return { title, chunks }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url } = body as { url: string }
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    const { title, chunks } = await scrapeUrl(url)
    return NextResponse.json({ chunks_saved: chunks.length, title })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
