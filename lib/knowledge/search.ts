import { createServiceClient } from '@/lib/supabase/service'

export async function searchKnowledge(query: string): Promise<string> {
  if (!query.trim()) return ''

  const supabase = createServiceClient()
  const { data: entries } = await supabase
    .from('knowledge_base')
    .select('title, content')
    .eq('is_active', true)

  if (!entries?.length) return ''

  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (!queryWords.length) return ''

  const scored = entries.map((entry) => {
    const text = `${entry.title} ${entry.content}`.toLowerCase()
    const score = queryWords.reduce((sum, word) => {
      const matches = (text.match(new RegExp(word, 'g')) ?? []).length
      return sum + matches
    }, 0)
    return { entry, score }
  })

  const top = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  if (!top.length) return ''

  return top.map((s) => `${s.entry.title}:\n${s.entry.content}`).join('\n\n---\n\n')
}
