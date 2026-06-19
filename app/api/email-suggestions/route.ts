import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (!q || q.length < 1) return NextResponse.json([])

  const term = `%${q.toLowerCase()}%`

  const { data } = await supabase
    .from('contacts')
    .select('email, full_name')
    .not('email', 'is', null)
    .or(`email.ilike.${term},full_name.ilike.${term}`)
    .filter('is_archived', 'eq', false)
    .order('full_name', { ascending: true })
    .limit(8)

  type Row = { email: string | null; full_name: string | null }
  const results = (data ?? [])
    .filter((r: Row) => r.email)
    .map((r: Row) => ({ email: r.email as string, name: r.full_name ?? '' }))

  return NextResponse.json(results)
}
