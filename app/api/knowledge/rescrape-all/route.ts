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

  const service = createServiceClient()

  // Get distinct URLs
  const { data: rows } = await service
    .from('knowledge_base')
    .select('source_url')
    .eq('source_type', 'url')
    .not('source_url', 'is', null)

  const urlSet: string[] = []
  const seen = new Set<string>()
  for (const r of rows ?? []) {
    if (r.source_url && !seen.has(r.source_url)) {
      seen.add(r.source_url)
      urlSet.push(r.source_url)
    }
  }
  const urls = urlSet

  let updated = 0
  const failed: string[] = []
  const now = new Date().toISOString()

  for (const url of urls) {
    try {
      const { title, chunks } = await scrapeUrl(url)
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
      updated++
    } catch {
      failed.push(url)
    }
  }

  return NextResponse.json({ updated, failed })
}
