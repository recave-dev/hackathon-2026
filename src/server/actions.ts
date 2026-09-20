import { ASSISTANT_NAME } from '../lib/wake-word.ts'
import { answerFromGraph, type GraphAnswer } from './graph-answer.ts'
import { intentById, type Intent } from '../lib/intents.ts'
import { chatJson, type WebSource } from './llm.ts'

/**
 * What Bolek can do when addressed. Jev picks the intent; this module runs it.
 *
 * Fast actions answer within a few seconds and are awaited by the screen.
 * Background actions start a task that keeps working after the call returns;
 * the screen polls `getTask` and shows the result when it lands.
 */

export interface TranscriptLine {
  id: string
  speaker: string
  text: string
  /** Wall-clock ms. */
  at: number
  /** True when the line was addressed to the assistant. */
  addressed?: boolean
}

export interface ActionInput {
  intent: Intent
  /** The request with the wake word removed. */
  request: string
  transcript: TranscriptLine[]
}

/** A short answer: from the graph, from general knowledge, or from the web. */
export interface AnswerResult {
  kind: 'answer'
  intent: Intent
  question: string
  headline: string
  answer: string
  bullets: string[]
  graph?: GraphAnswer
  sources: WebSource[]
  model: string
  latencyMs: number
}

/** Notes about the conversation itself. */
export interface NoteResult {
  kind: 'note'
  intent: 'meeting'
  question: string
  title: string
  /** Which part of the meeting the note covers. */
  scope: 'last_topic' | 'whole' | 'range'
  bullets: string[]
  decisions: string[]
  actionItems: { who: string; what: string }[]
  openQuestions: string[]
  /** Transcript line ids the note is based on. */
  coveredIds: string[]
  model: string
  latencyMs: number
}

/** A background job; poll `getTask` until `status` is done or failed. */
export interface TaskResult {
  kind: 'task'
  intent: Intent
  taskId: string
  question: string
  status: 'queued' | 'running' | 'done' | 'failed'
  label: string
  startedAt: number
  finishedAt?: number
  /** Markdown, when done. */
  markdown?: string
  title?: string
  error?: string
  model?: string
}

export type ActionResult = AnswerResult | NoteResult | TaskResult

const SPOKEN = `You are ${ASSISTANT_NAME}, a live assistant on the screen of a Polish company's board meeting. Reply in Polish, the way you would say it aloud in a meeting: short, concrete, no filler.`

const fmtTime = (ms: number): string => new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })

const renderTranscript = (lines: TranscriptLine[]): string =>
  lines.map((l) => `[${l.id}] ${fmtTime(l.at)} ${l.speaker}${l.addressed ? ` (do ${ASSISTANT_NAME})` : ''}: ${l.text}`).join('\n')

export async function runAction(input: ActionInput): Promise<ActionResult> {
  switch (input.intent) {
    case 'data':
      return dataAnswer(input)
    case 'meeting':
      return meetingNote(input)
    case 'web':
      return openAnswer(input, true)
    case 'general':
      return openAnswer(input, false)
    case 'report':
      return startReport(input)
    case 'person':
      // People are handled by the screen from the Jev result; if we still land here, fall back to data.
      return dataAnswer(input)
  }
}

async function dataAnswer(input: ActionInput): Promise<AnswerResult> {
  const recent = input.transcript
    .slice(-5, -1)
    .map((l) => `${l.speaker}: ${l.text}`)
  const graph = await answerFromGraph({ question: input.request, recent })
  return {
    kind: 'answer',
    intent: 'data',
    question: input.request,
    headline: graph.headline,
    answer: graph.answer,
    bullets: graph.bullets,
    graph,
    sources: [],
    model: graph.model,
    latencyMs: graph.latencyMs,
  }
}

interface RawOpen {
  headline?: unknown
  answer?: unknown
  bullets?: unknown
}

async function openAnswer(input: ActionInput, web: boolean): Promise<AnswerResult> {
  // The web plugin builds its search from the user message, so a web question travels alone:
  // meeting context would steer the search towards whatever the room was discussing.
  const context = web ? [] : input.transcript.slice(-6, -1)
  const system = `${SPOKEN}
The question may have nothing to do with the meeting agenda; answer it on its own merits.
${web ? 'Use the web search results provided to you. Prefer recent, authoritative sources and state the date of time-sensitive facts (rates, prices, news). Never answer that you lack access: the results are attached.' : 'Answer from general knowledge. Do not invent company-specific facts; if the question is really about this company, say that it should be checked in company data.'}
Return only JSON: {"headline": string (one figure, name or 3-word gist, max 40 chars, or ""), "answer": string (1-3 sentences), "bullets": string[] (0-4 short supporting points)}`
  const user = `${context.length ? `EARLIER TURNS (context only):\n${renderTranscript(context)}\n\n` : ''}QUESTION: ${input.request}`
  const res = await chatJson<RawOpen>({ system, user, web, maxTokens: 500 })
  return {
    kind: 'answer',
    intent: web ? 'web' : 'general',
    question: input.request,
    headline: String(res.data.headline ?? '').slice(0, 60),
    answer: String(res.data.answer ?? '').trim() || 'Nie udało się ułożyć odpowiedzi.',
    bullets: Array.isArray(res.data.bullets) ? res.data.bullets.map(String).slice(0, 4) : [],
    sources: res.sources,
    model: res.model,
    latencyMs: res.latencyMs,
  }
}

interface RawNote {
  title?: unknown
  scope?: unknown
  bullets?: unknown
  decisions?: unknown
  action_items?: unknown
  open_questions?: unknown
  covered_ids?: unknown
}

async function meetingNote(input: ActionInput): Promise<NoteResult> {
  // Everything said so far, minus the request itself.
  const lines = input.transcript.slice(0, -1)
  const system = `${SPOKEN}
You are given the transcript of the meeting so far, one line per turn with an id in brackets. Someone asked you to produce notes.

Rules:
- Decide the scope from the request: "the last thing we discussed" / "ostatni temat" means the most recent coherent topic (find the boundary yourself: usually where the subject changed or the chair moved the agenda); "the whole meeting" / "całe spotkanie" means everything; a named topic means the turns about it.
- Ignore turns addressed to ${ASSISTANT_NAME} and your own answers; they are not discussion.
- Bullets: 3-6 crisp facts or arguments actually said, with numbers and names as spoken. No invention, no padding.
- Decisions: only things clearly agreed or decided. Action items: only explicit commitments, with the person who took them. Open questions: things raised but not settled. Empty lists are fine.
- covered_ids: the ids of every transcript line the note is based on.

Return only JSON: {"title": string (max 60 chars), "scope": "last_topic"|"whole"|"range", "bullets": string[], "decisions": string[], "action_items": [{"who": string, "what": string}], "open_questions": string[], "covered_ids": string[]}`
  const user = `TRANSCRIPT:\n${renderTranscript(lines) || '(pusto)'}\n\nREQUEST: ${input.request}`
  const res = await chatJson<RawNote>({ system, user, maxTokens: 900 })
  const ids = new Set(lines.map((l) => l.id))
  const scope = res.data.scope === 'whole' || res.data.scope === 'range' ? res.data.scope : 'last_topic'
  const items = Array.isArray(res.data.action_items) ? res.data.action_items : []
  return {
    kind: 'note',
    intent: 'meeting',
    question: input.request,
    title: String(res.data.title ?? 'Notatka').slice(0, 80),
    scope,
    bullets: Array.isArray(res.data.bullets) ? res.data.bullets.map(String).slice(0, 8) : [],
    decisions: Array.isArray(res.data.decisions) ? res.data.decisions.map(String).slice(0, 6) : [],
    actionItems: items
      .map((i) => (i && typeof i === 'object' ? { who: String((i as { who?: unknown }).who ?? ''), what: String((i as { what?: unknown }).what ?? '') } : null))
      .filter((i): i is { who: string; what: string } => Boolean(i && i.what))
      .slice(0, 6),
    openQuestions: Array.isArray(res.data.open_questions) ? res.data.open_questions.map(String).slice(0, 6) : [],
    coveredIds: Array.isArray(res.data.covered_ids) ? res.data.covered_ids.map(String).filter((id) => ids.has(id)) : [],
    model: res.model,
    latencyMs: res.latencyMs,
  }
}

// Background tasks live in process memory (kept across dev-server hot reloads): fine for a demo, lost on restart.
const tasks: Map<string, TaskResult> = ((globalThis as { __bolekTasks?: Map<string, TaskResult> }).__bolekTasks ??= new Map())

export const getTask = (taskId: string): TaskResult | undefined => tasks.get(taskId)

interface RawReport {
  title?: unknown
  markdown?: unknown
}

function startReport(input: ActionInput): TaskResult {
  const taskId = `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const task: TaskResult = {
    kind: 'task',
    intent: 'report',
    taskId,
    question: input.request,
    status: 'running',
    label: intentById('report')!.label,
    startedAt: Date.now(),
  }
  tasks.set(taskId, task)

  void (async () => {
    try {
      // Pull whatever the graph knows about the request so the report has real numbers.
      const graph = await answerFromGraph({ question: input.request }).catch(() => undefined)
      const evidence = graph?.citations.map((c) => `[${c.id}] ${c.path}${c.date ? ` (${c.date})` : ''}\n${c.quote}`).join('\n\n') ?? ''
      const system = `You are ${ASSISTANT_NAME}, preparing a written document for a Polish company's board after a meeting. Write in Polish, in Markdown. Be structured and concrete: headings, short paragraphs, bullet lists, a table where numbers compare. Use only facts from the transcript and the company data given; mark anything uncertain as such. Do not invent numbers. 250-500 words.
Return only JSON: {"title": string, "markdown": string}`
      const user = `REQUEST: ${input.request}\n\nMEETING TRANSCRIPT:\n${renderTranscript(input.transcript.slice(0, -1)) || '(brak)'}\n\nCOMPANY DATA (graph answer to the request):\n${graph ? `${graph.answer}\n${graph.bullets.join('\n')}` : '(brak)'}\n\nSOURCE PASSAGES:\n${evidence || '(brak)'}`
      const res = await chatJson<RawReport>({ system, user, maxTokens: 1800, timeoutMs: 60000 })
      tasks.set(taskId, {
        ...task,
        status: 'done',
        finishedAt: Date.now(),
        title: String(res.data.title ?? 'Raport').slice(0, 100),
        markdown: String(res.data.markdown ?? '').trim() || '_Pusty raport._',
        model: res.model,
      })
    } catch (err) {
      tasks.set(taskId, { ...task, status: 'failed', finishedAt: Date.now(), error: err instanceof Error ? err.message : String(err) })
    }
  })()

  return task
}
