import { createServerFn } from '@tanstack/react-start'

import { FACET_LABEL, type Facet } from '../demo/knowledge.ts'
import type { RelevanceInput, RelevanceResult } from './relevance.ts'

export type { JudgeMode, RelevanceAction, RelevanceInput, RelevanceResult, RelevanceTarget, TranscriptTurn } from './relevance.ts'

const clean = (value: unknown, max: number): string => String(value ?? '').trim().slice(0, max)

/** Asks Jev (or the offline fallback) whether the latest utterance deserves a card. */
export const judgeUtterance = createServerFn({ method: 'POST' })
  .inputValidator((input: RelevanceInput): RelevanceInput => {
    const recent = (Array.isArray(input?.recent) ? input.recent : [])
      .slice(-6)
      .map((t) => ({ speaker: clean(t?.speaker, 80), text: clean(t?.text, 600) }))
      .filter((t) => t.text)
    if (recent.length === 0) throw new Error('Brak wypowiedzi do oceny.')
    return {
      meeting: {
        title: clean(input?.meeting?.title, 120),
        goal: clean(input?.meeting?.goal, 300),
        participants: (Array.isArray(input?.meeting?.participants) ? input.meeting.participants : []).slice(0, 12).map((p) => clean(p, 80)),
      },
      recent,
      mode: input?.mode === 'command' ? 'command' : 'ambient',
      trayItems: (Array.isArray(input?.trayItems) ? input.trayItems : []).slice(0, 20).map((t) => ({ id: clean(t?.id, 80), title: clean(t?.title, 120) })).filter((t) => t.id && t.title),
      presentations: (Array.isArray(input?.presentations) ? input.presentations : []).slice(0, 30).map((p) => ({ id: clean(p?.id, 80), title: clean(p?.title, 120) })).filter((p) => p.id && p.title),
    }
  })
  .handler(async ({ data }): Promise<RelevanceResult> => {
    // Dynamic import keeps the SDK and env access out of the client bundle.
    const { detectRelevance } = await import('./relevance.ts')
    return detectRelevance(data)
  })

export type { Citation, GraphAnswer } from './graph-answer.ts'

/** Answers an open question from the whole company graph with one fast LLM call. */
export const askGraph = createServerFn({ method: 'POST' })
  .inputValidator((input: { question: string; recent?: string[] }) => {
    const question = clean(input?.question, 500)
    if (!question) throw new Error('Pytanie nie może być puste.')
    const recent = (Array.isArray(input?.recent) ? input.recent : []).slice(-4).map((t) => clean(t, 300)).filter(Boolean)
    return { question, recent }
  })
  .handler(async ({ data }): Promise<import('./graph-answer.ts').GraphAnswer> => {
    const { answerFromGraph } = await import('./graph-answer.ts')
    return answerFromGraph(data)
  })

export type { NoteResult, TaskResult, TranscriptLine } from './actions.ts'

/** Polls a background task (report writing). */
export const getTask = createServerFn({ method: 'POST' })
  .inputValidator((input: { taskId: string }) => ({ taskId: clean(input?.taskId, 64) }))
  .handler(async ({ data }) => {
    const { getTask: get } = await import('./actions.ts')
    return get(data.taskId) ?? null
  })

export type { AgentResult, AgentStep } from './agent.ts'
export type { Attachment, ChartSpec } from './tools.ts'
export type { ContextDigest, EmailDraft, Session, SessionDoc, SessionLine, SessionSummary } from './session.ts'

const cleanLines = (input: unknown) =>
  (Array.isArray(input) ? input : [])
    .slice(-300)
    .map((l: { id?: unknown; speaker?: unknown; text?: unknown; at?: unknown; addressed?: unknown }) => ({ id: clean(l?.id, 40), speaker: clean(l?.speaker, 80), text: clean(l?.text, 800), at: Number(l?.at) || Date.now(), addressed: Boolean(l?.addressed) }))
    .filter((l) => l.id && l.text)

/** Feeds transcript lines into the meeting session and refreshes its context digest. */
export const syncSession = createServerFn({ method: 'POST' })
  .inputValidator((input: { sessionId: string; title?: string; company?: string; lines: import('./session.ts').SessionLine[]; reset?: boolean }) => ({
    sessionId: clean(input?.sessionId, 80) || 'default',
    title: clean(input?.title, 120) || undefined,
    company: clean(input?.company, 40) || undefined,
    lines: cleanLines(input?.lines),
    reset: Boolean(input?.reset),
  }))
  .handler(async ({ data }) => {
    const { appendLines, clearSession, loadSession } = await import('./session.ts')
    const { refreshDigest } = await import('./context.ts')
    if (data.reset) clearSession(data.sessionId)
    const session = loadSession(data.sessionId, data.title, data.company)
    const added = appendLines(session, data.lines)
    void refreshDigest(session)
    return { added, lines: session.lines.length, digest: session.digest }
  })

export type { FocusCommand, FocusInput, FocusKind, FocusResult } from './focus.ts'
export type { Deck, DeckSummary, Slide } from '../lib/slides.ts'

/** Focus mode: is what was just said a steering command for what is on screen, and which one? */
export const judgeFocus = createServerFn({ method: 'POST' })
  .inputValidator((input: import('./focus.ts').FocusInput): import('./focus.ts').FocusInput => ({
    text: clean(input?.text, 400),
    focus: {
      kind: 'presentation',
      title: clean(input?.focus?.title, 160),
      position: Math.max(1, Math.floor(Number(input?.focus?.position) || 1)),
      total: Math.max(0, Math.floor(Number(input?.focus?.total) || 0)),
      itemTitles: (Array.isArray(input?.focus?.itemTitles) ? input.focus.itemTitles : []).slice(0, 40).map((t) => clean(t, 120)),
    },
  }))
  .handler(async ({ data }) => {
    const { judgeFocusCommand } = await import('./focus.ts')
    return judgeFocusCommand(data)
  })

/** Stored presentations, newest first, without slide content. */
export const listPresentations = createServerFn({ method: 'GET' }).handler(async () => {
  const { listDecks } = await import('./presentations.ts')
  return listDecks()
})

export const getPresentation = createServerFn({ method: 'POST' })
  .inputValidator((input: { id: string }) => ({ id: clean(input?.id, 80) }))
  .handler(async ({ data }) => {
    const { getDeck } = await import('./presentations.ts')
    return getDeck(data.id)
  })

/** Adds a Markdown deck (slides separated by `---`) to the company presentations. */
export const savePresentation = createServerFn({ method: 'POST' })
  .inputValidator((input: { title?: string; markdown: string }) => {
    const markdown = String(input?.markdown ?? '').trim().slice(0, 200_000)
    if (!markdown) throw new Error('Wklej treść prezentacji.')
    return { title: clean(input?.title, 160), markdown }
  })
  .handler(async ({ data }) => {
    const { saveDeck } = await import('./presentations.ts')
    const { slides, ...rest } = saveDeck(data)
    return { ...rest, slides: slides.length }
  })

/** Every meeting session Bolek has seen, newest activity first. */
export const listSessions = createServerFn({ method: 'GET' }).handler(async () => {
  const { listSessions } = await import('./session.ts')
  return listSessions()
})

/** One session with its transcript, so the room can pick it up again. Null when it never existed. */
export const getSession = createServerFn({ method: 'POST' })
  .inputValidator((input: { sessionId: string }) => ({ sessionId: clean(input?.sessionId, 80) }))
  .handler(async ({ data }) => {
    const { listSessions, loadSession } = await import('./session.ts')
    if (!data.sessionId || !listSessions().some((s) => s.id === data.sessionId)) return null
    return loadSession(data.sessionId)
  })

/** Starts Bolek's agent on a request within the meeting session; poll `pollAgent` for progress and the result. */
export const askAgent = createServerFn({ method: 'POST' })
  .inputValidator((input: { sessionId: string; request: string; lines?: import('./session.ts').SessionLine[] }) => {
    const request = clean(input?.request, 800)
    if (!request) throw new Error('Pusta prośba.')
    return { sessionId: clean(input?.sessionId, 80) || 'default', request, lines: cleanLines(input?.lines) }
  })
  .handler(async ({ data }): Promise<{ jobId: string }> => {
    const { appendLines, loadSession } = await import('./session.ts')
    const { startAgentJob } = await import('./agent.ts')
    const session = loadSession(data.sessionId)
    if (data.lines.length) appendLines(session, data.lines)
    return { jobId: startAgentJob(session, data.request) }
  })

export const pollAgent = createServerFn({ method: 'POST' })
  .inputValidator((input: { jobId: string }) => ({ jobId: clean(input?.jobId, 64) }))
  .handler(async ({ data }): Promise<import('./agent.ts').AgentJob | null> => {
    const { getAgentJob } = await import('./agent.ts')
    return getAgentJob(data.jobId) ?? null
  })

/** Sends an email draft after the room confirmed. */
export const sendDraft = createServerFn({ method: 'POST' })
  .inputValidator((input: { sessionId: string; draftId?: string }) => ({ sessionId: clean(input?.sessionId, 80) || 'default', draftId: clean(input?.draftId, 60) || undefined }))
  .handler(async ({ data }): Promise<import('./session.ts').EmailDraft | null> => {
    const { loadSession, updateDraft } = await import('./session.ts')
    const { sendMail } = await import('./mail.ts')
    const session = loadSession(data.sessionId)
    // Without an id, "wyślij" means the newest unsent draft.
    const draft = data.draftId ? session.drafts.find((d) => d.id === data.draftId) : [...session.drafts].reverse().find((d) => d.status === 'draft' || d.status === 'failed')
    if (!draft) return null
    updateDraft(session, draft.id, { status: 'sending', error: undefined })
    try {
      await sendMail({ to: draft.to, subject: draft.subject, text: draft.body })
      return updateDraft(session, draft.id, { status: 'sent', sentAt: Date.now() }) ?? null
    } catch (err) {
      return updateDraft(session, draft.id, { status: 'failed', error: err instanceof Error ? err.message : String(err) }) ?? null
    }
  })

// ---------- cards straight from the graph ----------

export type { CardEvent, CardFact, CardOption, CardPerson, GraphCard, GraphCitation, PersonCard as GraphPersonCard, SpendSeries, TopicCard } from './graph-cards.ts'

/** Topics and people the router can pick, for tray titles and the debug rail. */
export const graphCatalog = createServerFn({ method: 'GET' }).handler(async () => {
  const { publicCatalog } = await import('./graph-cards.ts')
  try {
    return publicCatalog()
  } catch {
    return { company: null, topics: [], people: [] }
  }
})

const FACETS = Object.keys(FACET_LABEL) as Facet[]

/** One topic or person card, built deterministically from the graph. Null when the entity is gone. */
export const getGraphCard = createServerFn({ method: 'POST' })
  .inputValidator((input: { kind: 'topic' | 'person'; id: string; facet?: Facet }) => ({
    kind: (input?.kind === 'person' ? 'person' : 'topic') as 'topic' | 'person',
    id: clean(input?.id, 200),
    facet: (FACETS.includes(input?.facet as Facet) ? input.facet : 'general') as Facet,
  }))
  .handler(async ({ data }): Promise<import('./graph-cards.ts').GraphCard | null> => {
    const { buildCard } = await import('./graph-cards.ts')
    return buildCard(data)
  })

// ---------- direct paths that skip the agent ----------

const quickInput = (input: { sessionId: string; request: string; lines?: import('./session.ts').SessionLine[] }) => {
  const request = clean(input?.request, 800)
  if (!request) throw new Error('Pusta prośba.')
  return { sessionId: clean(input?.sessionId, 80) || 'default', request, lines: cleanLines(input?.lines) }
}

const plural = (n: number, one: string, few: string, many: string): string => {
  const m10 = n % 10
  const m100 = n % 100
  return `${n} ${n === 1 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many}`
}

/** "Zrób punkty z tego, co omawialiśmy": notes from the transcript, one Haiku call, no agent loop. */
export const quickNotes = createServerFn({ method: 'POST' })
  .inputValidator(quickInput)
  .handler(async ({ data }): Promise<import('./agent.ts').AgentResult> => {
    const { appendLines, loadSession } = await import('./session.ts')
    const { summarizeLines } = await import('./actions.ts')
    const started = performance.now()
    const session = loadSession(data.sessionId)
    if (data.lines.length) appendLines(session, data.lines)
    const note = await summarizeLines(session.lines, data.request)
    return {
      kind: 'agent',
      question: data.request,
      headline: '',
      answer: `${plural(note.bullets.length, 'punkt', 'punkty', 'punktów')}, ${plural(note.decisions.length, 'decyzja', 'decyzje', 'decyzji')}, ${plural(note.actionItems.length, 'zadanie', 'zadania', 'zadań')}.`,
      bullets: [],
      attachments: [{ type: 'note', note }],
      sources: [],
      steps: [{ tool: 'meeting_notes', args: JSON.stringify({ scope: note.scope }), summary: note.title, ms: note.latencyMs }],
      model: note.model,
      latencyMs: Math.round(performance.now() - started),
      needsInput: false,
    }
  })

/** "Jaki jest kurs euro?": one web-searching call, no agent loop. */
export const quickWeb = createServerFn({ method: 'POST' })
  .inputValidator(quickInput)
  .handler(async ({ data }): Promise<import('./agent.ts').AgentResult> => {
    const { appendLines, loadSession } = await import('./session.ts')
    const { webLookup } = await import('./tools.ts')
    const started = performance.now()
    const session = loadSession(data.sessionId)
    if (data.lines.length) appendLines(session, data.lines)
    const res = await webLookup(data.request)
    return {
      kind: 'agent',
      question: data.request,
      headline: '',
      answer: res.summary,
      bullets: res.facts.slice(0, 4),
      attachments: [],
      sources: res.sources,
      steps: [{ tool: 'search_web', args: JSON.stringify({ query: data.request }), summary: res.summary.slice(0, 200), ms: res.latencyMs }],
      model: res.model,
      latencyMs: Math.round(performance.now() - started),
      needsInput: false,
    }
  })
