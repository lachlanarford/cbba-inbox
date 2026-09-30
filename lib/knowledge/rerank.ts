import { score, type ScoreResponse } from '@typesafe-ai/sdk'
import { getTypeSafeClient } from '@/lib/ai/typesafe'

/** Starting gates for excerpt relevance. Retune on real CBBA questions. */
export const EXCERPT_SCORE_MIN = 1.5
export const EXCERPT_CONFIDENCE_MIN = 0.5
export const RERANK_KEEP = 5

const RELEVANCE = [
  'This excerpt does not help answer the visitor question.',
  'This excerpt mentions the topic but does not contain the fact the visitor needs.',
  'This excerpt contains a concrete fact that answers the visitor question.',
] as const

export interface ExcerptJudgment {
  score: number
  confidence: number
}

export function excerptIsUseful(judgment: ExcerptJudgment): boolean {
  return judgment.score >= EXCERPT_SCORE_MIN && judgment.confidence >= EXCERPT_CONFIDENCE_MIN
}

export function applyExcerptJudgments<T extends { bm25: number }>(
  items: T[],
  judgments: Array<ExcerptJudgment | null> | null,
): T[] {
  if (!judgments) {
    return items.filter((item) => item.bm25 > 0).slice(0, RERANK_KEEP)
  }

  return items
    .map((item, index) => ({ item, judgment: judgments[index] ?? null }))
    .filter((row): row is { item: T; judgment: ExcerptJudgment } => (
      row.item.bm25 > 0 && row.judgment != null && excerptIsUseful(row.judgment)
    ))
    .sort((a, b) => b.judgment.score - a.judgment.score)
    .slice(0, RERANK_KEEP)
    .map((row) => row.item)
}

export async function judgeExcerptRelevance(
  question: string,
  excerpts: Array<{ title: string; excerpt: string }>,
): Promise<Array<ExcerptJudgment | null> | null> {
  if (!excerpts.length) return []
  const client = getTypeSafeClient()
  if (!client) return null

  const questions: Record<string, ReturnType<typeof score<typeof RELEVANCE>>> = {}
  excerpts.forEach((_, index) => {
    questions[`excerpt_${index}`] = score(
      `How well does \`excerpts[${index}].text\` answer \`question\`? Judge only that excerpt.`,
      RELEVANCE,
    )
  })

  const response = await client.systemOne({
    state: {
      question,
      excerpts: excerpts.map((item) => ({ title: item.title, text: item.excerpt })),
    },
    questions,
  })

  return excerpts.map((_, index) => {
    const answer = response.answers[`excerpt_${index}`] as ScoreResponse<typeof RELEVANCE> | undefined
    if (!answer || answer.type !== 'score') return null
    return { score: answer.score, confidence: answer.confidence }
  })
}
