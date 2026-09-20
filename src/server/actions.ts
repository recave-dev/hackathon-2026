import { ASSISTANT_NAME } from '../lib/wake-word.ts'
import { answerFromGraph } from './graph-answer.ts'
import { chatJson } from './llm.ts'

/**
 * Longer pieces of work Bolek's tools delegate to: structured meeting notes
 * and background report writing. Background tasks keep working after the call
 * returns; the screen polls `getTask` and shows the result when it lands.
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

/** Notes about the conversation itself. */
export interface NoteResult {
  kind: 'note'
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

const SPOKEN = `You are ${ASSISTANT_NAME}, a live assistant on the screen of a Polish company's board meeting. Reply in Polish, the way you would say it aloud in a meeting: short, concrete, no filler.`

const fmtTime = (ms: number): string => new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })

const renderTranscript = (lines: TranscriptLine[]): string =>
  lines.map((l) => `[${l.id}] ${fmtTime(l.at)} ${l.speaker}${l.addressed ? ` (do ${ASSISTANT_NAME})` : ''}: ${l.text}`).join('\n')

interface RawNote {
  title?: unknown
  scope?: unknown
  bullets?: unknown
  decisions?: unknown
  action_items?: unknown
  open_questions?: unknown
  covered_ids?: unknown
}

/** Structured notes over a set of transcript lines, for a request such as "punkty z ostatniego tematu". */
export async function summarizeLines(lines: TranscriptLine[], request: string): Promise<NoteResult> {
  const system = `${SPOKEN}
You are given the transcript of the meeting so far, one line per turn with an id in brackets. Someone asked you to produce notes.

Rules:
- Decide the scope from the request: "the last thing we discussed" / "ostatni temat" means the most recent coherent topic (find the boundary yourself: usually where the subject changed or the chair moved the agenda); "the whole meeting" / "całe spotkanie" means everything; a named topic means the turns about it.
- Ignore turns addressed to ${ASSISTANT_NAME} and your own answers; they are not discussion.
- Bullets: 3-6 crisp facts or arguments actually said, with numbers and names as spoken. No invention, no padding. Dates: keep them exactly as said ("do dwunastego", "czternastego"); never add a month or year that was not spoken.
- Decisions: only things clearly agreed or decided. Action items: only explicit commitments, with the person who took them. Open questions: things raised but not settled. Empty lists are fine.
- covered_ids: the ids of every transcript line the note is based on.

Return only JSON: {"title": string (max 60 chars), "scope": "last_topic"|"whole"|"range", "bullets": string[], "decisions": string[], "action_items": [{"who": string, "what": string}], "open_questions": string[], "covered_ids": string[]}`
  const user = `TRANSCRIPT:\n${renderTranscript(lines) || '(pusto)'}\n\nREQUEST: ${request}`
  const res = await chatJson<RawNote>({ system, user, maxTokens: 900 })
  const ids = new Set(lines.map((l) => l.id))
  const scope = res.data.scope === 'whole' || res.data.scope === 'range' ? res.data.scope : 'last_topic'
  const items = Array.isArray(res.data.action_items) ? res.data.action_items : []
  return {
    kind: 'note',
    question: request,
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

/** Writes a report in the background from a brief and the transcript so far. */
export function startReportTask(request: string, transcript: TranscriptLine[]): TaskResult {
  const input = { request, transcript: [...transcript, { id: 'brief', speaker: 'brief', text: request, at: Date.now(), addressed: true }] }
  const taskId = `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const task: TaskResult = {
    kind: 'task',
    taskId,
    question: input.request,
    status: 'running',
    label: 'Przygotowuję raport',
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
