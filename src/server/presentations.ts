import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseDeck, type Deck, type DeckSummary } from '../lib/slides.ts'

/**
 * Server-only: where company presentations live. Built-in decks ship with the
 * repo in `knowledge/presentations/`; decks added from the workspace go to
 * `.data/presentations/`. Both are plain Markdown, see `src/lib/slides.ts`.
 */

const BUILT_IN = resolve(process.cwd(), 'knowledge/presentations')
const ADDED = resolve(process.cwd(), process.env.PRESENTATIONS_DIR ?? '.data/presentations')

const safeId = (id: string): string => id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)

function files(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md'))
  } catch {
    return []
  }
}

function read(dir: string, file: string, source: DeckSummary['source']): Deck | null {
  try {
    const path = resolve(dir, file)
    const parsed = parseDeck(readFileSync(path, 'utf8'))
    if (parsed.slides.length === 0) return null
    return { id: file.slice(0, -3), source, updatedAt: statSync(path).mtimeMs, ...parsed }
  } catch {
    return null
  }
}

function all(): Deck[] {
  const decks: Deck[] = []
  for (const f of files(ADDED)) {
    const d = read(ADDED, f, 'added')
    if (d) decks.push(d)
  }
  for (const f of files(BUILT_IN)) {
    if (decks.some((d) => d.id === f.slice(0, -3))) continue
    const d = read(BUILT_IN, f, 'built-in')
    if (d) decks.push(d)
  }
  return decks
}

/** Every deck, newest first; without slide content. */
export function listDecks(): DeckSummary[] {
  return all()
    .map(({ slides, ...rest }) => ({ ...rest, slides: slides.length }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getDeck(id: string): Deck | null {
  const key = safeId(id)
  if (!key) return null
  const added = resolve(ADDED, `${key}.md`)
  if (existsSync(added)) return read(ADDED, `${key}.md`, 'added')
  const builtIn = resolve(BUILT_IN, `${key}.md`)
  if (existsSync(builtIn)) return read(BUILT_IN, `${key}.md`, 'built-in')
  return null
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'prezentacja'

/** Stores a deck under `.data/presentations/`; the title goes into the front matter when the Markdown has none. */
export function saveDeck(input: { title: string; markdown: string }): Deck {
  const parsed = parseDeck(input.markdown)
  if (parsed.slides.length === 0) throw new Error('Prezentacja nie ma żadnego slajdu.')
  const title = input.title.trim() || parsed.title
  const hasFrontMatter = /^---\s*\n/.test(input.markdown)
  const markdown = hasFrontMatter ? input.markdown : `---\ntitle: ${title}\n---\n\n${input.markdown.trim()}\n`
  mkdirSync(ADDED, { recursive: true })
  let id = slug(title)
  let n = 2
  while (existsSync(resolve(ADDED, `${id}.md`)) || existsSync(resolve(BUILT_IN, `${id}.md`))) id = `${slug(title)}-${n++}`
  writeFileSync(resolve(ADDED, `${id}.md`), markdown)
  const deck = read(ADDED, `${id}.md`, 'added')
  if (!deck) throw new Error('Nie udało się zapisać prezentacji.')
  return deck
}
