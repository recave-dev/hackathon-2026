import type { KnowledgeGraph } from '../graph/index.ts'

/**
 * Server-only: the team directory. People Bolek can address by name, with
 * their email. Seeded into the company graph as person entities (idempotent)
 * so they show up in company_knowledge, and matched here by name in any
 * Polish case ("Tomasza Kielara", "Michałowi", "do Kielara").
 */

export interface DirectoryPerson {
  id: string
  name: string
  email: string
  role?: string
  /** Extra spellings: nicknames, ASCII forms. */
  aliases?: string[]
}

export const DIRECTORY: DirectoryPerson[] = [
  { id: 'person:michal-staskiewicz', name: 'Michał Staśkiewicz', email: 'mikoscz@bielsko.ai', role: 'Board member', aliases: ['Michal Staskiewicz', 'mikoscz'] },
  { id: 'person:tomasz-kielar', name: 'Tomasz Kielar', email: 'k1eu@bielsko.ai', role: 'Board member', aliases: ['k1eu'] },
]

/** Adds directory people to the graph if they are not there yet. */
export function ensureDirectory(g: KnowledgeGraph): void {
  for (const p of DIRECTORY) {
    if (g.getNode(p.id)) continue
    try {
      g.seedNode({ id: p.id, kind: 'person', label: p.name, aliases: p.aliases ?? [], attributes: { email: p.email, ...(p.role ? { role: p.role } : {}), source: 'team directory' } })
    } catch (err) {
      console.warn('directory: could not seed', p.id, err instanceof Error ? err.message : err)
    }
  }
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')

/** Polish names decline ("Tomasza", "Kielarowi"); the first few letters stay put. */
const stem = (w: string): string => fold(w).replace(/(owi|iem|em|ie|a|u|y|e|o|i)$/u, '')

const tokens = (s: string): string[] =>
  s
    .split(/[^\p{L}\p{N}@.]+/u)
    .filter((w) => w.length >= 3)

function nameScore(query: string, p: DirectoryPerson): number {
  const q = tokens(query).map(stem)
  const own = [...p.name.split(/\s+/), ...(p.aliases ?? []).flatMap((a) => a.split(/\s+/))].map(stem).filter(Boolean)
  let hits = 0
  for (const t of q) if (own.some((o) => o.length >= 3 && (o.startsWith(t) || t.startsWith(o)))) hits++
  if (query.toLowerCase().includes(p.email.toLowerCase())) hits += 2
  return hits
}

/** People whose name appears in the text, best match first. */
export function findContacts(query: string, people: DirectoryPerson[] = DIRECTORY): (DirectoryPerson & { score: number })[] {
  return people
    .map((p) => ({ ...p, score: nameScore(query, p) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
}
