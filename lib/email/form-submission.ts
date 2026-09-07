/** Known form-relay / noreply senders that should not receive staff replies. */
const FORM_RELAY_SENDERS = [
  /^form-submission@squarespace\.info$/i,
  /^noreply@squarespace\.com$/i,
  /^no-reply@squarespace\.com$/i,
]

export function isFormRelaySender(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return FORM_RELAY_SENDERS.some((re) => re.test(normalized))
}

export interface FormSubmissionContact {
  email: string
  fullName: string | null
}

/**
 * Extract the real submitter from Squarespace (and similar) form notification emails.
 * Body fields look like:
 *   Name: Annabelle Howse
 *   Email: showse1@parra.catholic.edu.au
 */
export function parseFormSubmissionContact(
  body: string,
  opts?: { fromEmail?: string | null; subject?: string | null }
): FormSubmissionContact | null {
  const from = opts?.fromEmail?.trim().toLowerCase() ?? ''
  const subject = opts?.subject ?? ''
  const looksLikeForm =
    isFormRelaySender(from) ||
    /form[- ]?submission/i.test(subject) ||
    /sent via form submission/i.test(body)

  if (!looksLikeForm) return null

  const plain = stripHtmlForFields(body)

  const email =
    matchField(plain, ['email', 'e-mail', 'email address']) ??
    matchEmailFallback(plain)
  if (!email) return null
  if (isFormRelaySender(email)) return null

  const fullName = matchField(plain, ['name', 'full name', 'your name'])

  return {
    email: email.toLowerCase(),
    fullName: fullName?.trim() || null,
  }
}

function stripHtmlForFields(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
}

function matchField(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(label)}\\s*[:\\-]\\s*(.+?)\\s*(?=\\n|$)`,
      'i'
    )
    const m = text.match(re)
    if (m?.[1]) {
      const value = m[1].trim()
      if (value) return value
    }
  }
  return null
}

function matchEmailFallback(text: string): string | null {
  // Prefer a line that looks like "Email: address"
  const labeled = text.match(/(?:^|\n)\s*e-?mail(?:\s+address)?\s*[:\-]\s*([^\s\n<]+@[^\s\n>]+)/i)
  if (labeled?.[1]) return labeled[1].trim()

  const emails = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []
  for (const email of emails) {
    if (!isFormRelaySender(email) && !/@squarespace\./i.test(email)) {
      return email
    }
  }
  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
