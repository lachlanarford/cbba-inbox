const HTML_TAG_RE =
  /<\/?(?:div|p|br|html|body|span|table|tr|td|ul|ol|li|a|img|blockquote|strong|em|b|i|h[1-6]|hr|font|center)(?:\s|>|\/)/i

export function looksLikeHtml(content: string): boolean {
  const trimmed = content.trimStart()
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<div') ||
    trimmed.startsWith('<p') ||
    trimmed.startsWith('<table') ||
    trimmed.startsWith('<span') ||
    trimmed.startsWith('<br')
  ) {
    return true
  }
  return HTML_TAG_RE.test(content.slice(0, 4000))
}

export function wrapHtmlFragment(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return content
  if (trimmed.startsWith('<')) return content
  return `<div>${content}</div>`
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
