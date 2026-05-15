import { load } from 'cheerio'

export interface ScrapeResult {
  title: string
  chunks: string[]
}

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 100

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CBBA-Inbox-Bot/1.0' },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)

  const html = await res.text()
  const $ = load(html)

  // Remove noise
  $('script, style, nav, footer, header, aside, iframe, noscript, [aria-hidden="true"]').remove()

  const title = $('title').text().trim() || $('h1').first().text().trim() || url

  const textParts: string[] = []

  $('h1, h2, h3, h4, p, li, td, th, blockquote').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (text.length > 20) textParts.push(text)
  })

  const fullText = textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  const chunks = chunkText(fullText)

  return { title, chunks }
}

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return text ? [text] : []

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length)
    chunks.push(text.slice(start, end))
    start = end - CHUNK_OVERLAP
    if (start >= text.length) break
  }

  return chunks
}
