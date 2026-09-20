import { ASSISTANT_NAME } from '../lib/wake-word.ts'
import { chatJson } from './llm.ts'
import { renderLines, saveSession, type ContextDigest, type Session } from './session.ts'

/**
 * Server-only: keeps the session's context digest fresh. The digest is what
 * the agent reads first, so it stays short: what the meeting is about, what
 * was established, decided, promised, and what is still open.
 */

const REFRESH_EVERY = 4
const inflight: Map<string, Promise<void>> = ((globalThis as { __bolekDigests?: Map<string, Promise<void>> }).__bolekDigests ??= new Map())

interface RawDigest {
  summary?: unknown
  facts?: unknown
  decisions?: unknown
  action_items?: unknown
  open_threads?: unknown
}

const strings = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, max) : [])

export const digestIsStale = (session: Session): boolean => !session.digest || session.lines.length - session.digest.coveredLines >= REFRESH_EVERY

/** Refreshes the digest if enough new lines arrived; concurrent calls share one run. */
export function refreshDigest(session: Session, force = false): Promise<void> {
  if (!force && !digestIsStale(session)) return Promise.resolve()
  const running = inflight.get(session.id)
  if (running) return running
  const p = (async () => {
    const lines = session.lines.filter((l) => !l.addressed)
    if (lines.length === 0) return
    const system = `You maintain the running context of a Polish company board meeting for an assistant called ${ASSISTANT_NAME}. Read the transcript and the previous digest, and return the updated digest as JSON. Write in Polish. Be terse and concrete: numbers, names, dates as said. Keep only what still matters; drop superseded items. Lines addressed to ${ASSISTANT_NAME} and its answers are not discussion.
Return only JSON: {"summary": string (2-3 sentences), "facts": string[] (max 12), "decisions": string[] (max 8), "action_items": [{"who": string, "what": string}] (max 8), "open_threads": string[] (max 8)}`
    const previous = session.digest ? `PREVIOUS DIGEST:\n${JSON.stringify({ summary: session.digest.summary, facts: session.digest.facts, decisions: session.digest.decisions, action_items: session.digest.actionItems, open_threads: session.digest.openThreads })}\n\n` : ''
    const user = `${previous}TRANSCRIPT (${lines.length} lines):\n${renderLines(lines.slice(-120))}`
    try {
      const res = await chatJson<RawDigest>({ system, user, maxTokens: 900, timeoutMs: 30000 })
      const items = Array.isArray(res.data.action_items) ? res.data.action_items : []
      const digest: ContextDigest = {
        summary: String(res.data.summary ?? '').trim(),
        facts: strings(res.data.facts, 12),
        decisions: strings(res.data.decisions, 8),
        actionItems: items
          .map((i) => (i && typeof i === 'object' ? { who: String((i as { who?: unknown }).who ?? ''), what: String((i as { what?: unknown }).what ?? '') } : null))
          .filter((i): i is { who: string; what: string } => Boolean(i && i.what))
          .slice(0, 8),
        openThreads: strings(res.data.open_threads, 8),
        coveredLines: session.lines.length,
        updatedAt: Date.now(),
      }
      session.digest = digest
      saveSession(session)
    } catch (err) {
      console.warn('digest: failed', err instanceof Error ? err.message : err)
    }
  })().finally(() => inflight.delete(session.id))
  inflight.set(session.id, p)
  return p
}

export function renderDigest(d: ContextDigest | null): string {
  if (!d) return '(brak; spotkanie dopiero się zaczęło)'
  const list = (title: string, items: string[]) => (items.length ? `${title}:\n${items.map((i) => `- ${i}`).join('\n')}` : '')
  return [
    d.summary,
    list('Ustalone fakty', d.facts),
    list('Decyzje', d.decisions),
    d.actionItems.length ? `Zadania:\n${d.actionItems.map((a) => `- ${a.who ? `${a.who}: ` : ''}${a.what}`).join('\n')}` : '',
    list('Otwarte wątki', d.openThreads),
  ]
    .filter(Boolean)
    .join('\n\n')
}
