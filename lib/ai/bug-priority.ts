import { choice } from '@typesafe-ai/sdk'
import { getTypeSafeClient } from '@/lib/ai/typesafe'

export const BUG_PRIORITIES = ['low', 'medium', 'high'] as const
export type BugPriority = (typeof BUG_PRIORITIES)[number]

/** Below this, do not store a suggested priority. Retune on CBBA bug reports. */
export const BUG_PRIORITY_CONFIDENCE_MIN = 0.5

export function acceptSuggestedPriority(choice: string, confidence: number): BugPriority | null {
  if (confidence < BUG_PRIORITY_CONFIDENCE_MIN) return null
  if (!(BUG_PRIORITIES as readonly string[]).includes(choice)) return null
  return choice as BugPriority
}

export async function judgeBugPriority(title: string, description: string): Promise<BugPriority | null> {
  const client = getTypeSafeClient()
  if (!client) return null

  const response = await client.systemOne({
    state: { report: { title, description } },
    questions: {
      priority: choice(
        'Which priority should staff use for `report.title` and `report.description`?',
        {
          high: 'The inbox cannot be used, data may be wrong, or a customer-facing path is broken.',
          medium: 'A feature is impaired but staff can keep working.',
          low: 'A cosmetic issue or a small inconvenience.',
        },
      ),
    },
  })

  return acceptSuggestedPriority(response.answers.priority.choice, response.answers.priority.confidence)
}
