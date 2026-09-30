import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankConversationSearch, SEARCH_CANDIDATE_LIMIT } from '@/lib/inbox/semantic-search'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!query) return NextResponse.json({ mode: 'keyword', ids: [] })

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, subject')
    .order('last_message_at', { ascending: false })
    .limit(SEARCH_CANDIDATE_LIMIT)

  const rows = conversations ?? []
  if (!rows.length) return NextResponse.json({ mode: 'semantic', ids: [] })

  const ids = rows.map((row) => row.id)
  const { data: messages } = await supabase
    .from('messages')
    .select('conversation_id, content, created_at')
    .in('conversation_id', ids)
    .eq('is_internal_note', false)
    .order('created_at', { ascending: false })

  const latest = new Map<string, string>()
  for (const message of messages ?? []) {
    if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message.content)
  }

  const candidates = rows.map((row) => ({
    id: row.id,
    text: [row.subject ?? '', latest.get(row.id) ?? ''].filter(Boolean).join('\n').slice(0, 800),
  }))

  try {
    const matched = await rankConversationSearch(query, candidates)
    if (!matched) return NextResponse.json({ mode: 'keyword', ids: [] })
    return NextResponse.json({ mode: 'semantic', ids: matched })
  } catch (err) {
    console.error('[inbox/search]', err)
    return NextResponse.json({ mode: 'keyword', ids: [] })
  }
}
