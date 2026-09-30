import type { Department, Priority } from '@/types/database'

export const DEPARTMENTS = ['Reps', 'Comps', 'LTP', 'Referees', 'Other'] as const satisfies readonly Department[]
export const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const satisfies readonly Priority[]

/** Starting gate from the TypeSafe confidence guide: below this, do not write a label. Retune on CBBA mail. */
export const LABEL_CONFIDENCE_MIN = 0.5

/** Flag safety a little earlier than a clear yes. Retune on CBBA mail. */
export const SAFETY_REVIEW_MIN = 0.4

/** Clearer-than-even yes for complaint, payment, and near-term events. Retune on CBBA mail. */
export const REVIEW_NOUL_MIN = 0.6

/** Frustration score at or above this, with enough confidence, is worth a glance. Retune on CBBA mail. */
export const FRUSTRATION_ATTENTION_MIN = 1.5
export const FRUSTRATION_CONFIDENCE_MIN = 0.5
export const REFUND_ATTENTION_MIN = 0.6

export type LabelSource = 'channel' | 'staff' | 'ai' | 'legacy'

export interface TriageScores {
  safety: number
  complaint: number
  payment: number
  soon: number
  refund: number
  missing_details: number
  frustration: number
  frustration_confidence: number
}

export function buildTriageScores(input: {
  safety: number
  complaint: number
  payment: number
  soon: number
  refund: number
  missingDetails: number
  frustration: number
  frustrationConfidence: number
}): TriageScores {
  return {
    safety: input.safety,
    complaint: input.complaint,
    payment: input.payment,
    soon: input.soon,
    refund: input.refund,
    missing_details: input.missingDetails,
    frustration: input.frustration,
    frustration_confidence: input.frustrationConfidence,
  }
}

export function readTriageScores(value: unknown): TriageScores | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const num = (key: string) => (typeof row[key] === 'number' ? row[key] as number : null)
  const safety = num('safety')
  const complaint = num('complaint')
  const payment = num('payment')
  const soon = num('soon')
  const refund = num('refund')
  const missing = num('missing_details')
  const frustration = num('frustration')
  const frustrationConfidence = num('frustration_confidence')
  if (
    safety == null || complaint == null || payment == null || soon == null
    || refund == null || missing == null || frustration == null || frustrationConfidence == null
  ) return null
  return {
    safety,
    complaint,
    payment,
    soon,
    refund,
    missing_details: missing,
    frustration,
    frustration_confidence: frustrationConfidence,
  }
}

/** Code applies these gates. Stored numbers stay raw so the gates can change later. */
export function scoresNeedAttention(scores: TriageScores | null): boolean {
  if (!scores) return false
  const frustrated = scores.frustration >= FRUSTRATION_ATTENTION_MIN
    && scores.frustration_confidence >= FRUSTRATION_CONFIDENCE_MIN
  return frustrated || scores.refund >= REFUND_ATTENTION_MIN || scores.safety >= SAFETY_REVIEW_MIN
}

export interface TriageSignals {
  department: string
  departmentConfidence: number
  priority: string
  priorityConfidence: number
  safety: number
  complaint: number
  payment: number
  soon: number
}

export interface TriageWrite {
  department?: Department
  department_source?: 'ai'
  priority?: Priority
  priority_source?: 'ai'
  needs_review?: true
}

export function isDepartment(value: string): value is Department {
  return (DEPARTMENTS as readonly string[]).includes(value)
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value)
}

/** A label may be written only while nobody else has claimed it. */
export function labelIsOpen(source: string | null): boolean {
  return source == null
}

export function decideTriageWrite(
  current: { departmentSource: string | null; prioritySource: string | null },
  signals: TriageSignals,
): TriageWrite {
  const write: TriageWrite = {}

  if (labelIsOpen(current.departmentSource)) {
    if (isDepartment(signals.department) && signals.departmentConfidence >= LABEL_CONFIDENCE_MIN) {
      write.department = signals.department
      write.department_source = 'ai'
    } else {
      write.needs_review = true
    }
  }

  if (labelIsOpen(current.prioritySource)) {
    if (isPriority(signals.priority) && signals.priorityConfidence >= LABEL_CONFIDENCE_MIN) {
      write.priority = signals.priority
      write.priority_source = 'ai'
    } else {
      write.needs_review = true
    }
  }

  const review =
    signals.safety >= SAFETY_REVIEW_MIN
    || signals.complaint >= REVIEW_NOUL_MIN
    || signals.payment >= REVIEW_NOUL_MIN
    || signals.soon >= REVIEW_NOUL_MIN

  if (review) write.needs_review = true

  return write
}
