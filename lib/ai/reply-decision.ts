/** Starting gates for reply drafts. Retune on real CBBA threads. */
export const CANNED_CONFIDENCE_MIN = 0.5
export const UNSUPPORTED_FACT_MIN = 0.6

export function pickCannedResponse(input: {
  choice: string
  confidence: number
  ids: readonly string[]
}): string | null {
  if (input.confidence < CANNED_CONFIDENCE_MIN) return null
  if (input.choice === 'none') return null
  if (!input.ids.includes(input.choice)) return null
  return input.choice
}

export function draftNeedsFactCheck(unsupportedProbability: number): boolean {
  return unsupportedProbability >= UNSUPPORTED_FACT_MIN
}
