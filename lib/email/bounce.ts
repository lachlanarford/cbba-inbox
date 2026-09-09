const BOUNCE_SENDERS = [
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^mail-daemon@/i,
]

const BOUNCE_SUBJECT = /^(?:(?:re|fwd|fw)\s*:\s*)*(delivery status notification|undelivered mail returned to sender|mail delivery failed|returned mail|failure notice|undeliverable)/i

export function isBounceSubject(subject: string | null | undefined): boolean {
  if (!subject) return false
  return BOUNCE_SUBJECT.test(subject.trim())
}

export function isBounceSender(email: string | null | undefined): boolean {
  if (!email) return false
  return BOUNCE_SENDERS.some((re) => re.test(email.trim()))
}

/** True for automated bounce / DSN messages that should not become inbox conversations.
 *  Only key off the sender — real people sometimes reply inside a bounce thread and keep the DSN subject.
 */
export function isBounceOrDsnEmail(opts: {
  fromEmail?: string | null
  fromName?: string | null
  subject?: string | null
}): boolean {
  if (isBounceSender(opts.fromEmail)) return true
  const name = opts.fromName?.trim().toLowerCase() ?? ''
  if (name === 'mail delivery subsystem' || name === 'mailer-daemon') return true
  return false
}

/** Strip Re:/Fwd: and return a usable reply subject when the stored one is a bounce title. */
export function resolveReplySubject(
  conversationSubject: string | null | undefined,
  fallbackFromName?: string | null
): string {
  const subject = (conversationSubject ?? '').trim() || '(no subject)'
  if (!isBounceSubject(subject)) return subject

  const cleaned = subject
    .replace(/^(re|fwd|fw)\s*:\s*/gi, '')
    .trim()

  if (cleaned && !isBounceSubject(cleaned)) return cleaned

  const name = fallbackFromName?.trim()
  if (name && !/^mail delivery/i.test(name) && !/^mailer-daemon/i.test(name)) {
    return `Message from ${name}`
  }
  return 'Follow-up'
}
