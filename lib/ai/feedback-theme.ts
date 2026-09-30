import { choice } from '@typesafe-ai/sdk'
import { getTypeSafeClient } from '@/lib/ai/typesafe'

export const FEEDBACK_THEMES = [
  'response_time',
  'wrong_information',
  'staff_helpfulness',
  'unresolved',
  'other',
] as const

export type FeedbackTheme = (typeof FEEDBACK_THEMES)[number]

/** Below this, leave the theme unset so a person can read the comment. Retune on CBBA comments. */
export const THEME_CONFIDENCE_MIN = 0.5

export function acceptFeedbackTheme(choice: string, confidence: number): FeedbackTheme | null {
  if (confidence < THEME_CONFIDENCE_MIN) return null
  if (!(FEEDBACK_THEMES as readonly string[]).includes(choice)) return null
  return choice as FeedbackTheme
}

export async function judgeFeedbackTheme(comment: string): Promise<{ theme: FeedbackTheme | null; confidence: number } | null> {
  const client = getTypeSafeClient()
  if (!client || !comment.trim()) return null

  const response = await client.systemOne({
    state: { comment },
    questions: {
      theme: choice(
        'Which single theme best describes `comment`?',
        {
          response_time: 'The comment is about how long a reply took.',
          wrong_information: 'The comment says the answer or information was wrong.',
          staff_helpfulness: 'The comment is about whether staff were helpful or friendly.',
          unresolved: 'The comment says the issue is still not solved.',
          other: 'The comment does not fit response time, wrong information, helpfulness, or an unresolved issue.',
        },
      ),
    },
  })

  return {
    theme: acceptFeedbackTheme(response.answers.theme.choice, response.answers.theme.confidence),
    confidence: response.answers.theme.confidence,
  }
}
