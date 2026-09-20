import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Server-only: a meeting session. Everything the room produces lands here:
 * the transcript, Bolek's answers, documents, email drafts, and a rolling
 * context digest. One JSON file per session under `.data/sessions/`, cached in
 * memory across dev-server reloads.
 */

export interface SessionLine {
  id: string
  speaker: string
  text: string
  /** Wall-clock ms. */
  at: number
  /** True when the line was addressed to the assistant. */
  addressed?: boolean
}

export interface ContextDigest {
  /** Two or three sentences: what this meeting is about and where it stands. */
  summary: string
  facts: string[]
  decisions: string[]
  actionItems: { who: string; what: string }[]
  openThreads: string[]
  /** How many transcript lines the digest has seen. */
  coveredLines: number
  updatedAt: number
}

export interface SessionDoc {
  id: string
  title: string
  markdown: string
  createdAt: number
}

export interface EmailDraft {
  id: string
  to: string[]
  subject: string
  body: string
  createdAt: number
  status: 'draft' | 'sending' | 'sent' | 'failed'
  sentAt?: number
  error?: string
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  lines: SessionLine[]
  digest: ContextDigest | null
  documents: SessionDoc[]
  drafts: EmailDraft[]
  /** Which company graph this meeting is about (`aster` by default, `bielsko` for the bielsko.ai demo). */
  company?: string
}

const DIR = resolve(process.cwd(), process.env.SESSION_DIR ?? '.data/sessions')
const cache: Map<string, Session> = ((globalThis as { __bolekSessions?: Map<string, Session> }).__bolekSessions ??= new Map())

const safeId = (id: string): string => id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'default'
const fileFor = (id: string): string => resolve(DIR, `${safeId(id)}.json`)

export function loadSession(id: string, title?: string, company?: string): Session {
  const key = safeId(id)
  const cached = cache.get(key)
  if (cached) return cached
  let session: Session | undefined
  const file = fileFor(key)
  if (existsSync(file)) {
    try {
      session = JSON.parse(readFileSync(file, 'utf8')) as Session
    } catch {
      session = undefined
    }
  }
  session ??= { id: key, title: title ?? key, createdAt: Date.now(), updatedAt: Date.now(), lines: [], digest: null, documents: [], drafts: [] }
  if (title && session.title !== title) session.title = title
  if (company && session.company !== company) session.company = company
  cache.set(key, session)
  return session
}

export function saveSession(session: Session): void {
  session.updatedAt = Date.now()
  cache.set(session.id, session)
  try {
    mkdirSync(DIR, { recursive: true })
    writeFileSync(fileFor(session.id), JSON.stringify(session, null, 1))
  } catch (err) {
    console.warn('session: could not persist', err instanceof Error ? err.message : err)
  }
}

/** Adds lines the session has not seen (by id), keeping time order. */
export function appendLines(session: Session, lines: SessionLine[]): number {
  const seen = new Set(session.lines.map((l) => l.id))
  let added = 0
  for (const line of lines) {
    if (seen.has(line.id) || !line.text.trim()) continue
    session.lines.push(line)
    seen.add(line.id)
    added++
  }
  if (added) {
    session.lines.sort((a, b) => a.at - b.at)
    if (session.lines.length > 2000) session.lines = session.lines.slice(-2000)
    saveSession(session)
  }
  return added
}

/** What the Sessions list needs: no transcript, just the shape of the meeting. */
export interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  lineCount: number
  /** How many lines were addressed to the assistant. */
  askedCount: number
  summary: string | null
  firstLine: string | null
  documents: number
  drafts: number
  sent: number
}

const isSession = (v: unknown): v is Session => typeof v === 'object' && v !== null && typeof (v as Session).id === 'string' && Array.isArray((v as Session).lines)

export function summarize(session: Session): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lineCount: session.lines.length,
    askedCount: session.lines.filter((l) => l.addressed).length,
    summary: session.digest?.summary ?? null,
    firstLine: session.lines[0]?.text ?? null,
    documents: session.documents.length,
    drafts: session.drafts.length,
    sent: session.drafts.filter((d) => d.status === 'sent').length,
  }
}

/** Every session on disk (and in memory), newest activity first. */
export function listSessions(): SessionSummary[] {
  const ids = new Set<string>(cache.keys())
  try {
    for (const f of readdirSync(DIR)) if (f.endsWith('.json')) ids.add(f.slice(0, -5))
  } catch {
    /* no sessions yet */
  }
  const out: SessionSummary[] = []
  for (const id of ids) {
    const cached = cache.get(id)
    let session: Session | undefined = cached
    if (!session) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(fileFor(id), 'utf8'))
        if (isSession(parsed)) session = parsed
      } catch {
        session = undefined
      }
    }
    if (session && session.id === id) out.push(summarize(session))
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function clearSession(id: string): void {
  const key = safeId(id)
  cache.delete(key)
  try {
    writeFileSync(fileFor(key), JSON.stringify({ id: key, title: key, createdAt: Date.now(), updatedAt: Date.now(), lines: [], digest: null, documents: [], drafts: [] }, null, 1))
  } catch {
    /* ignore */
  }
}

const uid = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function addDocument(session: Session, title: string, markdown: string): SessionDoc {
  const doc: SessionDoc = { id: uid('doc'), title, markdown, createdAt: Date.now() }
  session.documents.push(doc)
  saveSession(session)
  return doc
}

export function addDraft(session: Session, draft: Omit<EmailDraft, 'id' | 'createdAt' | 'status'>): EmailDraft {
  const d: EmailDraft = { id: uid('mail'), createdAt: Date.now(), status: 'draft', ...draft }
  session.drafts.push(d)
  saveSession(session)
  return d
}

export function updateDraft(session: Session, id: string, patch: Partial<EmailDraft>): EmailDraft | undefined {
  const d = session.drafts.find((x) => x.id === id)
  if (!d) return undefined
  Object.assign(d, patch)
  saveSession(session)
  return d
}

export const fmtTime = (ms: number): string => new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })

export const renderLines = (lines: SessionLine[], assistant = 'Bolek'): string =>
  lines.map((l) => `[${l.id}] ${fmtTime(l.at)} ${l.speaker}${l.addressed ? ` (do ${assistant})` : ''}: ${l.text}`).join('\n')
