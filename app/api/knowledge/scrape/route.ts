import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdmin } from '@/lib/auth'
import { scrapeUrl } from '@/lib/knowledge/scraper'

export async function POST(request: Request) {
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

  // Delete existing chunks for this URL then re-insert
  await service.from('knowledge_base').delete().eq('source_url', url)

  if (chunks.length > 0) {
    await service.from('knowledge_base').insert(
      chunks.map((chunk, i) => ({
        title: chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title,
        content: chunk,
        source_type: 'url',
        source_url: url,
        last_scraped_at: now,
        is_active: true,
      }))
    )
  }

  return NextResponse.json({ chunks_saved: chunks.length, title })
}
