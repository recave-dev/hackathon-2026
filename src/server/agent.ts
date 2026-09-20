import { openGraph } from './graph-answer.ts'
import { ASSISTANT_NAME } from '../lib/wake-word.ts'
import { refreshDigest, renderDigest } from './context.ts'
import { openrouterKey, type WebSource } from './llm.ts'
import type { Session } from './session.ts'
import { TOOLS, recentTranscript, toolByName, type Attachment } from './tools.ts'

/**
 * Server-only: Bolek as an agent. One request from the room becomes a short
 * tool-use loop: the model reads the meeting context, decides which tools to
 * call (possibly several, in sequence), and finishes with a spoken-style
 * answer plus whatever the tools put on screen.
 */

export interface AgentStep {
  tool: string
  /** The call's arguments, JSON-encoded (kept as a string so the result serialises anywhere). */
  args: string
  /** First lines of what the tool returned. */
  summary: string
  ms: number
  error?: string
}

export interface AgentResult {
  kind: 'agent'
  question: string
  headline: string
  answer: string
  bullets: string[]
  attachments: Attachment[]
  sources: WebSource[]
  steps: AgentStep[]
  model: string
  latencyMs: number
  /** True when the agent needs something from the room (an address, a URL). */
  needsInput: boolean
}

const MAX_STEPS = 6
const agentModel = (): string => process.env.AGENT_MODEL?.trim() || 'anthropic/claude-sonnet-5'

const FINAL_TOOL = {
  type: 'function',
  function: {
    name: 'final_answer',
    description: 'Finish: what to show and say to the room. Call this exactly once, as the last step.',
    parameters: {
      type: 'object',
      properties: {
        headline: { type: 'string', description: 'One figure, name or 3-word gist for the big print (max 40 chars), or empty.' },
        answer: { type: 'string', description: '1-3 sentences in Polish, as said aloud in the meeting.' },
        bullets: { type: 'array', items: { type: 'string' }, description: '0-4 short supporting points.' },
        needs_input: { type: 'boolean', description: 'True if you are asking the room for something (an address, a URL, a choice) before you can finish.' },
      },
      required: ['answer'],
    },
  },
} as const

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

function companyName(company?: string | null): string {
  try {
    const g = openGraph(company)
    return g.getGraphSnapshot().nodes.find((n) => n.kind === 'organization' && n.attributes.role === 'company')?.label ?? 'the company'
  } catch {
    return 'the company'
  }
}

function systemPrompt(session: Session): string {
  return `You are ${ASSISTANT_NAME}, the assistant sitting in on the board meeting of ${companyName(session.company)}, a Polish company. People address you by name; the screen in the room shows your answers. Answer in Polish, the way you would speak in a meeting: short, concrete, numbers and names first, no filler and no preamble.

How to work:
- Decide what the request needs. Anything about the company itself lives in the company graph: costs, invoices, approvals, owners, pilots, customers, decisions, events and meetups, venues and offers we collected, partners, statistics, the website. Start with company_knowledge (query in English), then get_entity or list_entities to dig further if the first search is thin. Never state a company figure you did not get from a tool.
- "Find venues / options / candidates" for our own events or projects means: what have we already gathered? Search company_knowledge first; only if the graph has nothing, use search_web and say the results are from the internet.
- Comparing two or more things (venues, vendors, editions of an event): get the facts, then compare_table with the criteria as columns; mention in the cells what we know from history (e.g. which venue hosted an earlier edition) and any offer or cost with its source.
- Questions about this conversation ("what did we decide", "bullet points of the last topic") use meeting_notes or the CONTEXT below; do not search the graph for them.
- Fresh outside facts (rates, news, competitors) use search_web. General knowledge you may answer directly.
- Graphics ("zrób grafikę", a poster or banner): generate_image, with the event's name, date, time and venue from the CONTEXT or the graph in the prompt. Website changes ("zaktualizuj stronę"): update_website with the concrete new values; it runs in the background.
- "Show our landing page" and similar: page_screenshot. If the address is unknown and not configured, ask for it (needs_input=true) instead of guessing.
- Emails: when a recipient is named, find_contact gives the address; draft_email only prepares; the room confirms sending. Documents: create_document. Charts from numbers you have: chart. Long reports: write_report (background) and say it is being prepared.
- Use at most a few tool calls; stop as soon as you can answer. If a tool returns nothing useful, say what you could not find rather than inventing.
- Always finish by calling final_answer.

MEETING: ${session.title}
CONTEXT DIGEST (what has been established so far):
${renderDigest(session.digest)}

LAST TURNS:
${recentTranscript(session, 14) || '(none yet)'}`
}

export interface AgentJob {
  jobId: string
  request: string
  status: 'running' | 'done' | 'failed'
  steps: AgentStep[]
  /** What the agent is doing right now, for the screen. */
  activity: string
  result?: AgentResult
  error?: string
  startedAt: number
}

const jobs: Map<string, AgentJob> = ((globalThis as { __bolekAgentJobs?: Map<string, AgentJob> }).__bolekAgentJobs ??= new Map())

export const getAgentJob = (jobId: string): AgentJob | undefined => jobs.get(jobId)

const TOOL_ACTIVITY: Record<string, string> = {
  company_knowledge: 'Przeszukuję dane firmy',
  list_entities: 'Przeglądam graf firmy',
  get_entity: 'Czytam szczegóły',
  find_contact: 'Szukam adresu',
  search_web: 'Szukam w internecie',
  page_screenshot: 'Otwieram stronę',
  draft_email: 'Piszę maila',
  create_document: 'Piszę dokument',
  meeting_notes: 'Czytam transkrypcję',
  chart: 'Rysuję wykres',
  write_report: 'Zlecam raport',
  compare_table: 'Układam porównanie',
  generate_image: 'Generuję grafikę',
  update_website: 'Zlecam aktualizację strony',
}

/** `final_answer(answer="…", bullets=["…"], headline="…")` written as prose: pull the fields out. */
function parsePseudoFinal(text: string | undefined): Record<string, unknown> | null {
  if (!text || !/^\s*final_answer\s*\(/.test(text)) return null
  const field = (name: string): string | undefined => new RegExp(`${name}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's').exec(text)?.[1]?.replace(/\\"/g, '"').replace(/\\n/g, '\n')
  const bulletsRaw = /bullets\s*=\s*\[([\s\S]*?)\]/.exec(text)?.[1] ?? ''
  const bullets = [...bulletsRaw.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!.replace(/\\"/g, '"'))
  const answer = field('answer')
  if (!answer) return null
  return { answer, headline: field('headline') ?? '', bullets, needs_input: /needs_input\s*=\s*[Tt]rue/.test(text) }
}

/** One chat completion; a response cut off mid-JSON (it happens on long tool calls) is fetched again once. */
async function completeWithRetry(key: string, payload: string): Promise<{ model?: string; choices?: { message?: Message }[] }> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': `${ASSISTANT_NAME} agent` },
      body: payload,
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const text = await res.text()
    try {
      return JSON.parse(text) as { model?: string; choices?: { message?: Message }[] }
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`OpenRouter returned an unreadable response: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

/** Runs the agent in the background and exposes its progress under a job id. */
export function startAgentJob(session: Session, request: string): string {
  const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const job: AgentJob = { jobId, request, status: 'running', steps: [], activity: 'Myślę', startedAt: Date.now() }
  jobs.set(jobId, job)
  void runAgent(session, request, (event) => {
    if (event.type === 'tool_start') job.activity = TOOL_ACTIVITY[event.tool] ?? event.tool
    else if (event.type === 'step') {
      job.steps = [...job.steps, event.step]
      job.activity = 'Myślę'
    }
  })
    .then((result) => {
      job.status = 'done'
      job.result = result
      job.activity = ''
    })
    .catch((err: unknown) => {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : String(err)
      console.error('agent job failed', err)
      job.activity = ''
    })
  // Forget finished jobs after a while.
  setTimeout(() => jobs.delete(jobId), 30 * 60 * 1000).unref?.()
  return jobId
}

export type AgentEvent = { type: 'tool_start'; tool: string } | { type: 'step'; step: AgentStep }

export async function runAgent(session: Session, request: string, onEvent?: (e: AgentEvent) => void): Promise<AgentResult> {
  const started = performance.now()
  const key = openrouterKey()
  if (!key) throw new Error('Brak klucza OpenRouter (OPENROUTER_API_KEY).')
  // A fresh digest helps every request; wait only when it is badly stale.
  const refresh = refreshDigest(session)
  if (!session.digest) await refresh

  const tools = [...TOOLS.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } })), FINAL_TOOL]
  const system = systemPrompt(session)
  if (process.env.AGENT_DEBUG) console.log(`agent: session=${session.id} company=${session.company ?? '-'} model=${agentModel()} tools=${tools.length} prompt=${system.length} chars\n${system.slice(0, 400)}`)
  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: request },
  ]
  const steps: AgentStep[] = []
  const attachments: Attachment[] = []
  const sources: WebSource[] = []
  let model = agentModel()
  let final: { headline?: unknown; answer?: unknown; bullets?: unknown; needs_input?: unknown } | null = null
  let plainAnswer = ''

  for (let round = 0; round < MAX_STEPS && !final; round++) {
    const payload = JSON.stringify({ model: agentModel(), temperature: 0.2, max_tokens: 3000, messages, tools, tool_choice: round === MAX_STEPS - 1 ? { type: 'function', function: { name: 'final_answer' } } : 'auto' })
    const body = await completeWithRetry(key, payload)
    model = body.model ?? model
    const msg = body.choices?.[0]?.message
    if (!msg) throw new Error('Pusta odpowiedź modelu.')
    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })

    if (!msg.tool_calls?.length) {
      plainAnswer = (msg.content ?? '').trim()
      // Some models write the final call out as text instead of calling it; read it the same way.
      const pseudo = parsePseudoFinal(plainAnswer)
      if (pseudo) {
        final = pseudo
        plainAnswer = ''
      }
      break
    }
    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
      } catch {
        args = {}
      }
      if (call.function.name === 'final_answer') {
        final = args
        messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: 'ok' })
        continue
      }
      const tool = toolByName(call.function.name)
      onEvent?.({ type: 'tool_start', tool: call.function.name })
      const t0 = performance.now()
      let content: string
      let error: string | undefined
      if (!tool) {
        content = `Unknown tool ${call.function.name}.`
        error = content
      } else {
        try {
          const out = await tool.run(args, { session, request })
          content = out.content
          if (out.attachments) attachments.push(...out.attachments)
          if (out.sources) for (const s of out.sources) if (!sources.some((x) => x.url === s.url)) sources.push(s)
        } catch (err) {
          error = err instanceof Error ? err.message : String(err)
          content = `Tool failed: ${error}`
        }
      }
      const step: AgentStep = { tool: call.function.name, args: JSON.stringify(args).slice(0, 400), summary: content.split('\n').slice(0, 3).join(' ').slice(0, 200), ms: Math.round(performance.now() - t0), error }
      steps.push(step)
      onEvent?.({ type: 'step', step })
      messages.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: content.slice(0, 12000) })
    }
  }

  // Spoken text on a screen: no Markdown emphasis markers.
  const plain = (t: string): string => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|\s)\*(\S[^*]*)\*(?=\s|$)/g, '$1$2')
  const bullets = Array.isArray(final?.bullets) ? final!.bullets.map((b) => plain(String(b))).filter(Boolean).slice(0, 4) : []
  return {
    kind: 'agent',
    question: request,
    headline: String(final?.headline ?? '').slice(0, 60),
    answer: plain(String(final?.answer ?? plainAnswer ?? '')).trim() || 'Nie udało mi się ułożyć odpowiedzi.',
    bullets,
    attachments,
    sources,
    steps,
    model,
    latencyMs: Math.round(performance.now() - started),
    needsInput: Boolean(final?.needs_input),
  }
}
