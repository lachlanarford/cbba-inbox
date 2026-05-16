import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 100

function extractFromHtml(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = (titleMatch?.[1] ?? '').trim()
    .replace(/&amp;/g, '&').replace(/&mdash;/g, '-').replace(/&#39;/g, "'").replace(/&quot;/g, '"')

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&mdash;/g, '-')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { title: title || 'Untitled', text }
}

function chunkText(text: string): string[] {
  if (!text) return []
  if (text.length <= CHUNK_SIZE) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end))
    start = end - CHUNK_OVERLAP
    if (start >= text.length) break
  }
  return chunks
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: appUser } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (!appUser || !isAdmin(appUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json() as { url?: string }
    const { url } = body
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    const res = await fetch(url, {
      headers: { 'User-Agent': 'CBBA-Inbox-Bot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ error: `Could not fetch URL (HTTP ${res.status})` }, { status: 422 })

    const html = await res.text()
    const { title, text } = extractFromHtml(html)
    const chunks = chunkText(text)

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No content extracted from URL' }, { status: 422 })
    }

    const service = createServiceClient()
    const now = new Date().toISOString()

    await service.from('knowledge_base').delete().eq('source_url', url)

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

    return NextResponse.json({ chunks_saved: chunks.length, title })
  } catch (err) {
    return NextResponse.json({ error: `Error: ${String(err)}` }, { status: 500 })
  }
}
