import { createServiceClient } from '@/lib/supabase/service'

export interface KnowledgeSearchOptions {
  conversationContext?: string
  department?: string | null
}

export interface KnowledgeSearchResult {
  context: string
  sources: string[]
}

interface KnowledgeRow {
  title: string
  content: string
  source_type: string
  category: string | null
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
  'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'them', 'than',
  'its', 'over', 'such', 'this', 'that', 'with', 'from', 'they', 'will', 'what',
  'when', 'where', 'which', 'who', 'how', 'why', 'does', 'did', 'doing', 'just',
  'about', 'into', 'your', 'their', 'there', 'then', 'than', 'also', 'any',
  'please', 'thanks', 'thank', 'hello', 'hi', 'hey', 'yes', 'yeah', 'ok',
  'okay', 'want', 'need', 'get', 'got', 'would', 'could', 'should', 'like',
  'looking', 'know', 'tell', 'give', 'let', 'able', 'still', 'already',
  'currently', 'someone', 'something', 'anything', 'check', 'asking',
])

const SYNONYMS: Record<string, string[]> = {
  enrol: ['enroll', 'enrolment', 'enrollment', 'register', 'registration', 'rego', 'signup', 'sign'],
  enroll: ['enrol', 'enrolment', 'enrollment', 'register', 'registration'],
  register: ['enrol', 'enroll', 'registration', 'rego', 'membership'],
  registration: ['enrol', 'register', 'rego', 'membership'],
  beginner: ['beginners', 'aussie', 'hoops', 'introductory', 'learn', 'class'],
  beginners: ['beginner', 'aussie', 'hoops', 'class'],
  class: ['beginner', 'program', 'hoops', 'aussie'],
  kids: ['child', 'children', 'junior', 'son', 'daughter'],
  child: ['kids', 'children', 'junior', 'son', 'daughter'],
  son: ['child', 'kids', 'junior', 'daughter'],
  daughter: ['child', 'kids', 'junior', 'son'],
  ref: ['referee', 'referees', 'refereeing', 'official', 'officiating'],
  referee: ['ref', 'referees', 'refereeing', 'official', 'officiating'],
  coaching: ['coach', 'coaches'],
  coach: ['coaching', 'coaches'],
  comp: ['competition', 'comps', 'domestic', 'league', 'winter'],
  comps: ['competition', 'comp', 'domestic', 'league'],
  competition: ['comp', 'domestic', 'league', 'winter'],
  masters: ['35+', '40+', '40s', 'veteran', 'open'],
  '40s': ['masters', '35+', '40+', 'veteran'],
  '40': ['masters', '35+', '40+'],
  fixture: ['fixtures', 'draw', 'draws', 'results', 'schedule', 'games'],
  fixtures: ['fixture', 'draw', 'results', 'schedule', 'games'],
  results: ['fixture', 'draw', 'livescore', 'games', 'schedule'],
  games: ['fixture', 'fixtures', 'draw', 'schedule', 'results'],
  fee: ['fees', 'cost', 'price', 'pricing'],
  fees: ['fee', 'cost', 'price'],
  cost: ['fee', 'fees', 'price'],
  refund: ['refunds', 'withdraw', 'unenroll', 'cancel', 'cancellation'],
  membership: ['member', 'rego', 'registration', 'bnsw'],
  stanhope: ['leisure', 'blc'],
  druitt: ['kbs', 'kevin', 'betts', 'stadium'],
  kbs: ['kevin', 'betts', 'druitt', 'stadium'],
  hoops: ['aussie', 'beginner', 'assist'],
  assist: ['hoops', 'disability', 'inclusive'],
  ltp: ['aussie', 'hoops', 'learn'],
  reps: ['representative', 'rep', 'waratah'],
  rep: ['representative', 'reps', 'waratah'],
}

const DEPARTMENT_TERMS: Record<string, string[]> = {
  LTP: ['aussie', 'hoops', 'beginner', 'learn', 'ltp'],
  Comps: ['domestic', 'competition', 'winter', 'league', 'fixture', 'comps'],
  Reps: ['representative', 'rep', 'waratah', 'selection', 'tryout'],
  Referees: ['referee', 'referees', 'officiating', 'official'],
}

const INTERNAL_TITLE_RE =
  /payroll|timesheet|hobbyist\s+pay|budgeting|employee\s+work|onboarding\s+procedure|xero|game sheets and scores|ticketing and sales/i

const BM25_K1 = 1.5
const BM25_B = 0.75
const TITLE_WEIGHT = 4
const MAX_RESULTS = 5
const MAX_EXCERPT_CHARS = 1400

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
}

function expandTerms(terms: string[]): string[] {
  const extra: string[] = []
  for (const term of terms) {
    const mapped = SYNONYMS[term]
    if (mapped) extra.push(...mapped)
  }
  return Array.from(new Set([...terms, ...extra]))
}

function isCustomerFacing(entry: KnowledgeRow): boolean {
  if (INTERNAL_TITLE_RE.test(entry.title)) return false
  return true
}

function customerBoost(entry: KnowledgeRow): number {
  if (entry.source_type === 'manual') return 2.4
  if (/^kb-\d+/i.test(entry.title)) return 2.4
  return 1
}

function termFreq(haystack: string, term: string): number {
  if (!term) return 0
  let count = 0
  let idx = 0
  while (idx < haystack.length) {
    const found = haystack.indexOf(term, idx)
    if (found === -1) break
    const before = found === 0 || !/[a-z0-9]/.test(haystack[found - 1] ?? '')
    const afterEnd = found + term.length
    const after = afterEnd >= haystack.length || !/[a-z0-9]/.test(haystack[afterEnd] ?? '')
    if (before && after) count++
    idx = found + term.length
  }
  return count
}

function bestExcerpt(content: string, terms: string[]): string {
  const text = content.replace(/\s+/g, ' ').trim()
  if (text.length <= MAX_EXCERPT_CHARS) return text

  const lower = text.toLowerCase()
  const hits: number[] = []
  for (const term of terms) {
    if (term.length < 3) continue
    let idx = 0
    while (idx < lower.length) {
      const found = lower.indexOf(term, idx)
      if (found === -1) break
      hits.push(found)
      idx = found + term.length
    }
  }

  if (!hits.length) {
    return text.slice(0, MAX_EXCERPT_CHARS).trim() + '...'
  }

  hits.sort((a, b) => a - b)
  let bestStart = hits[0]
  let bestCount = 0
  let left = 0
  for (let right = 0; right < hits.length; right++) {
    while (hits[right] - hits[left] > MAX_EXCERPT_CHARS) left++
    const count = right - left + 1
    if (count > bestCount) {
      bestCount = count
      bestStart = hits[left]
    }
  }

  const start = Math.max(0, bestStart - 80)
  const excerpt = text.slice(start, start + MAX_EXCERPT_CHARS).trim()
  const prefix = start > 0 ? '...' : ''
  const suffix = start + MAX_EXCERPT_CHARS < text.length ? '...' : ''
  return `${prefix}${excerpt}${suffix}`
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/^kb-\d+\s*\|\s*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function rankKnowledgeEntries(
  entries: KnowledgeRow[],
  query: string,
  options: KnowledgeSearchOptions = {},
): Array<{ entry: KnowledgeRow; score: number; excerpt: string }> {
  const combinedQuery = [options.conversationContext, query].filter(Boolean).join(' ')
  let terms = expandTerms(tokenize(combinedQuery))
  const deptTerms = options.department ? DEPARTMENT_TERMS[options.department] : undefined
  if (deptTerms) terms = Array.from(new Set([...terms, ...deptTerms]))

  const eligible = entries.filter((e) => e.content && isCustomerFacing(e))
  if (!eligible.length || !terms.length) return []

  const docFreq = new Map<string, number>()
  const prepared = eligible.map((entry) => {
    const titleLower = entry.title.toLowerCase()
    const bodyLower = entry.content.toLowerCase()
    const categoryLower = (entry.category ?? '').toLowerCase()
    const length = Math.max(bodyLower.length, 1)
    return { entry, titleLower, bodyLower, categoryLower, length }
  })

  const avgLen = prepared.reduce((sum, d) => sum + d.length, 0) / prepared.length
  const n = prepared.length

  for (const term of terms) {
    let df = 0
    for (const doc of prepared) {
      if (doc.titleLower.includes(term) || doc.bodyLower.includes(term) || doc.categoryLower.includes(term)) {
        df++
      }
    }
    docFreq.set(term, df)
  }

  const scored = prepared.map((doc) => {
    let score = 0
    for (const term of terms) {
      const df = docFreq.get(term) ?? 0
      if (df === 0) continue
      const idf = Math.log((n - df + 0.5) / (df + 0.5) + 1)
      const titleTf = termFreq(doc.titleLower, term) * TITLE_WEIGHT
      const categoryTf = doc.categoryLower.includes(term) ? 2 : 0
      const bodyTf = termFreq(doc.bodyLower, term)
      const tf = titleTf + categoryTf + bodyTf
      if (tf === 0) continue
      const denom = tf + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / avgLen))
      score += idf * ((tf * (BM25_K1 + 1)) / denom)
    }
    score *= customerBoost(doc.entry)
    return { entry: doc.entry, score, excerpt: bestExcerpt(doc.entry.content, terms) }
  })

  scored.sort((a, b) => b.score - a.score)

  const deduped: typeof scored = []
  const seen = new Set<string>()
  for (const item of scored) {
    if (item.score <= 0) continue
    const key = normalizeTitle(item.entry.title)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
    if (deduped.length >= MAX_RESULTS) break
  }

  return deduped
}

export async function searchKnowledge(
  query: string,
  options: KnowledgeSearchOptions = {},
): Promise<KnowledgeSearchResult> {
  if (!query.trim()) return { context: '', sources: [] }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('knowledge_base')
    // category exists in DB; generated types are stale
    .select('title, content, source_type, category' as 'title, content, source_type')
    .eq('is_active', true)

  const entries = (data ?? []) as unknown as KnowledgeRow[]
  if (!entries.length) return { context: '', sources: [] }

  let ranked = rankKnowledgeEntries(entries, query, options)

  if (ranked.length < 2) {
    const manuals = entries.filter((e) => e.source_type === 'manual' && isCustomerFacing(e))
    const already = new Set(ranked.map((r) => r.entry.title))
    for (const entry of manuals) {
      if (already.has(entry.title)) continue
      ranked.push({
        entry,
        score: 0,
        excerpt: bestExcerpt(entry.content, tokenize(query)),
      })
    }
    ranked = ranked.slice(0, MAX_RESULTS)
  }

  if (!ranked.length) return { context: '', sources: [] }

  const context = ranked
    .map((s) => `## ${s.entry.title}\n${s.excerpt}`)
    .join('\n\n---\n\n')

  return { context, sources: ranked.map((s) => s.entry.title) }
}
