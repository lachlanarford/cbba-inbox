import { score, type ScoreResponse } from '@typesafe-ai/sdk'
import { getTypeSafeClient } from '@/lib/ai/typesafe'

export const SEARCH_SCORE_MIN = 1.5
export const SEARCH_CONFIDENCE_MIN = 0.5
export const SEARCH_CANDIDATE_LIMIT = 40

const RELEVANCE = [
  'This conversation is not what the search is looking for.',
  'This conversation mentions related words but is not the request.',
  'This conversation is what the staff member is searching for.',
] as const

export function shouldUseSemanticSearch(query: string): boolean {
  const trimmed = query.trim()
  if (trimmed.length < 3) return false
  if (trimmed.includes('@')) return false
  return true
}

export function keepSearchHit(scoreValue: number, confidence: number): boolean {
  return scoreValue >= SEARCH_SCORE_MIN && confidence >= SEARCH_CONFIDENCE_MIN
}

export async function rankConversationSearch(
  query: string,
  candidates: Array<{ id: string; text: string }>,
): Promise<string[] | null> {
  if (!shouldUseSemanticSearch(query)) return null
  const client = getTypeSafeClient()
  if (!client) return null
  const slice = candidates.slice(0, SEARCH_CANDIDATE_LIMIT)
  if (!slice.length) return []

  const questions: Record<string, ReturnType<typeof score<typeof RELEVANCE>>> = {}
  slice.forEach((_, index) => {
    questions[`hit_${index}`] = score(
      `How well does \`candidates[${index}].text\` match the staff search \`query\`? Judge only that conversation.`,
      RELEVANCE,
    )
  })

  const response = await client.systemOne({
    state: {
      query,
      candidates: slice.map((item) => ({ id: item.id, text: item.text })),
    },
    questions,
  })

  return slice
    .map((item, index) => {
      const answer = response.answers[`hit_${index}`] as ScoreResponse<typeof RELEVANCE> | undefined
      if (!answer || answer.type !== 'score') return null
      if (!keepSearchHit(answer.score, answer.confidence)) return null
      return { id: item.id, score: answer.score }
    })
    .filter((row): row is { id: string; score: number } => row != null)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.id)
}
