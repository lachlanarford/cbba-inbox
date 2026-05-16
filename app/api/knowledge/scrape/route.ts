import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

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
  const title = titleMatch ? titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&#39;/g, "'") : url

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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: { url: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { url } = body
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    let title: string
    let chunks: string[]
    try {
      const result = await scrapeUrl(url)
      title = result.title
      chunks = result.chunks
    } catch (err) {
      return NextResponse.json({ error: `Scrape failed: ${String(err)}` }, { status: 422 })
    }

    const service = createServiceClient()
    const now = new Date().toISOString()

    await service.from('knowledge_base').delete().eq('source_url', url)

    if (chunks.length > 0) {
      const { error: insertError } = await service.from('knowledge_base').insert(
        chunks.map((chunk, i) => ({
          title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
          content: chunk,
          source_type: 'url',
          source_url: url,
          last_scraped_at: now,
          is_active: true,
        }))
      )
      if (insertError) return NextResponse.json({ error: `DB error: ${insertError.message}` }, { status: 500 })
    }

    return NextResponse.json({ chunks_saved: chunks.length, title })
  } catch (err) {
    console.error('[knowledge/scrape] unhandled error:', err)
    return NextResponse.json({ error: `Unexpected error: ${String(err)}` }, { status: 500 })
  }
}
