/**
 * Presentations are Markdown files: optional front matter (title, description),
 * then slides separated by `---` lines. The first heading of a slide is its
 * title. Shared by server and client, so no server-only imports here.
 */

export interface Slide {
  /** 0-based. */
  index: number
  title: string
  /** Markdown without the title line. */
  body: string
}

export interface DeckSummary {
  id: string
  title: string
  description: string
  slides: number
  source: 'built-in' | 'added'
  updatedAt: number
}

export interface Deck extends Omit<DeckSummary, 'slides'> {
  slides: Slide[]
}

const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

function frontMatter(markdown: string): { meta: Record<string, string>; body: string } {
  const lines = markdown.replace(/\r/g, '').split('\n')
  if (lines[0]?.trim() !== '---') return { meta: {}, body: markdown }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end < 0) return { meta: {}, body: markdown }
  const meta: Record<string, string> = {}
  for (const line of lines.slice(1, end)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line)
    if (m) meta[m[1]!.toLowerCase()] = m[2]!.trim()
  }
  return { meta, body: lines.slice(end + 1).join('\n') }
}

/** Splits Markdown into slides; a deck with no separators is one slide. */
export function parseDeck(markdown: string): { title: string; description: string; slides: Slide[] } {
  const { meta, body } = frontMatter(markdown)
  const chunks = body
    .replace(/\r/g, '')
    .split('\n')
    .reduce<string[][]>(
      (acc, line) => {
        if (RULE.test(line)) acc.push([])
        else acc[acc.length - 1]!.push(line)
        return acc
      },
      [[]],
    )
    .map((c) => c.join('\n').trim())
    .filter(Boolean)

  const slides: Slide[] = chunks.map((chunk, index) => {
    const lines = chunk.split('\n')
    const headingAt = lines.findIndex((l) => /^#{1,3}\s+\S/.test(l))
    const title = headingAt >= 0 ? lines[headingAt]!.replace(/^#{1,3}\s+/, '').trim() : `Slajd ${index + 1}`
    const rest = headingAt >= 0 ? [...lines.slice(0, headingAt), ...lines.slice(headingAt + 1)] : lines
    return { index, title, body: rest.join('\n').trim() }
  })

  const title = meta.title || slides[0]?.title || 'Prezentacja'
  const firstParagraph = slides[0]?.body.split('\n').find((l) => l.trim() && !/^[-*|#\d]/.test(l.trim())) ?? ''
  const description = meta.description || firstParagraph.slice(0, 160)
  return { title, description, slides }
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')

const STOP = new Set(['prezentacja', 'prezentacje', 'prezentacji', 'prezentacj', 'slajdy', 'slajd', 'otworz', 'pokaz', 'odpal', 'wlacz', 'uruchom', 'nasza', 'nasze', 'ta', 'te', 'ten', 'o', 'z', 'na', 'do', 'w'])

/** Polish declensions keep the first letters ("budżetu" → "budz"), so prefixes are enough. */
const stem = (w: string): string => fold(w).replace(/(owego|owej|ego|emu|ach|ami|iem|em|ie|ów|om|a|e|i|o|u|y)$/u, '')

const tokens = (s: string): string[] =>
  fold(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length >= 3)

/** Same stem, allowing for Polish consonant shifts ("budżet" → "budżecie"): a shared 4-letter prefix is enough. */
const similar = (a: string, b: string): boolean => a.startsWith(b) || b.startsWith(a) || (a.length >= 5 && b.length >= 5 && a.slice(0, 4) === b.slice(0, 4))

/** The deck whose title shares the most words with the request, or undefined when nothing overlaps. */
export function matchDeck<T extends { title: string; description?: string }>(query: string, decks: T[]): T | undefined {
  const q = tokens(query)
  if (q.length === 0) return undefined
  let bestDeck: T | undefined
  let bestScore = 0
  for (const d of decks) {
    const title = tokens(d.title)
    const desc = tokens(d.description ?? '')
    let score = 0
    for (const t of q) {
      if (title.some((w) => similar(w, t))) score += 2
      else if (desc.some((w) => similar(w, t))) score += 0.5
    }
    if (score > bestScore) {
      bestScore = score
      bestDeck = d
    }
  }
  return bestScore >= 2 ? bestDeck : undefined
}

/** Which slide a request names, by number or ordinal ("trzeci", "slajd 5"), 1-based; null when none. */
export function parseSlideNumber(text: string, total: number): number | null {
  const t = fold(text)
  const digit = /(?:slajd\w*|stron\w*|numer|nr)\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:slajd|stron)/.exec(t)
  const n = digit ? Number(digit[1] ?? digit[2]) : null
  if (n && n >= 1 && n <= total) return n
  const ORDINALS: [RegExp, number][] = [
    [/\bpierwsz/, 1],
    [/\bdrug/, 2],
    [/\btrzec/, 3],
    [/\bczwart/, 4],
    [/\bpiat/, 5],
    [/\bszost/, 6],
    [/\bsiodm/, 7],
    [/\bosm/, 8],
    [/\bdziewiat/, 9],
    [/\bdziesiat/, 10],
    [/\bjedenast/, 11],
    [/\bdwunast/, 12],
  ]
  for (const [re, value] of ORDINALS) if (re.test(t) && value <= total) return value
  return null
}
