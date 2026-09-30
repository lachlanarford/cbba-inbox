/** Starting gates for chat routing. Retune on real CBBA chats. */
export const HANDLER_CONFIDENCE_MIN = 0.5
export const WANTS_HUMAN_MIN = 0.6
export const COMPLAINT_MIN = 0.6
export const NEEDS_FACTS_MIN = 0.6
export const NEEDS_FACTS_UNSURE_MIN = 0.4
export const EXCERPTS_ANSWER_MIN = 0.6
export const EXCERPTS_UNSURE_MIN = 0.4
export const INJECTION_MIN = 0.5
export const SENSITIVE_MIN = 0.6
export const INVENTED_DETAIL_MIN = 0.6
export const IGNORES_EXCERPTS_MIN = 0.6

export type ChatHandler = 'answer' | 'decline' | 'handoff'
export type ChatAction = 'generate' | 'decline' | 'handoff'

export interface ChatRouteSignals {
  handler: string
  handlerConfidence: number
  wantsHuman: number
  complaint: number
  needsFacts: number
  excerptsAnswer: number
  hasExcerpts: boolean
  injection: number
  sensitive: number
}

export interface ChatRouteDecision {
  action: ChatAction
  needsReview: boolean
}

export function decideChatRoute(signals: ChatRouteSignals): ChatRouteDecision {
  if (signals.injection >= INJECTION_MIN) {
    return { action: 'decline', needsReview: true }
  }
  if (signals.sensitive >= SENSITIVE_MIN) {
    return { action: 'handoff', needsReview: true }
  }

  if (signals.wantsHuman >= WANTS_HUMAN_MIN || signals.complaint >= COMPLAINT_MIN) {
    return { action: 'handoff', needsReview: true }
  }

  if (signals.handlerConfidence < HANDLER_CONFIDENCE_MIN || !isHandler(signals.handler)) {
    return { action: 'decline', needsReview: true }
  }

  if (signals.handler === 'handoff') return { action: 'handoff', needsReview: true }
  if (signals.handler === 'decline') return { action: 'decline', needsReview: false }

  if (signals.needsFacts >= NEEDS_FACTS_MIN) {
    if (signals.hasExcerpts && signals.excerptsAnswer >= EXCERPTS_ANSWER_MIN) {
      return { action: 'generate', needsReview: false }
    }
    const unsure = signals.excerptsAnswer >= EXCERPTS_UNSURE_MIN && signals.excerptsAnswer < EXCERPTS_ANSWER_MIN
    return { action: 'decline', needsReview: unsure }
  }

  if (signals.needsFacts >= NEEDS_FACTS_UNSURE_MIN) {
    return { action: 'decline', needsReview: true }
  }

  return { action: 'generate', needsReview: false }
}

export function blockGeneratedReply(invented: number, ignoresExcerpts: number): boolean {
  return invented >= INVENTED_DETAIL_MIN || ignoresExcerpts >= IGNORES_EXCERPTS_MIN
}

function isHandler(value: string): value is ChatHandler {
  return value === 'answer' || value === 'decline' || value === 'handoff'
}
