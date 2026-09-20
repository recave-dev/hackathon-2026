import { ASSISTANT_NAME } from '../lib/wake-word.ts'
import { startReportTask, summarizeLines, type NoteResult, type TaskResult } from './actions.ts'
import { screenshotPage } from './browser.ts'
import { DIRECTORY, findContacts } from './directory.ts'
import { openGraph, retrieveChunks, spendTotals } from './graph-answer.ts'
import { chatJson, type WebSource } from './llm.ts'
import { mailConfigured } from './mail.ts'
import { addDocument, addDraft, renderLines, type Session } from './session.ts'

/**
 * Server-only: the tools Bolek can reach for. Each one is a schema the model
 * sees, a handler, and what it hands back: text for the model to reason on
 * and, optionally, attachments for the screen. Adding a tool is one entry in
 * TOOLS below.
 */

export type JsonSchema = Record<string, unknown>

export interface ChartSpec {
  title: string
  kind: 'bar' | 'line'
  unit?: string
  series: { name: string; data: { label: string; value: number }[] }[]
}

export type Attachment =
  | { type: 'screenshot'; url: string; pageUrl: string; title: string }
  | { type: 'document'; id: string; title: string; markdown: string }
  | { type: 'chart'; spec: ChartSpec }
  | { type: 'email_draft'; id: string; to: string[]; subject: string; body: string }
  | { type: 'task'; task: TaskResult }
  | { type: 'note'; note: NoteResult }
  | { type: 'citations'; items: { id: string; quote: string; path: string; date: string | null }[] }

export interface ToolContext {
  session: Session
  request: string
}

export interface ToolOutput {
  /** What the model reads back. Keep it compact and factual. */
  content: string
  attachments?: Attachment[]
  sources?: WebSource[]
}

export interface ToolDef {
  name: string
  description: string
  parameters: JsonSchema
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutput>
}

const str = (v: unknown, max = 2000): string => String(v ?? '').trim().slice(0, max)
const list = (v: unknown, max = 20): string[] => (Array.isArray(v) ? v.map((x) => str(x, 200)).filter(Boolean).slice(0, max) : str(v) ? [str(v)] : [])

// ---------- company graph ----------

const companyKnowledge: ToolDef = {
  name: 'company_knowledge',
  description:
    'Search the company knowledge graph (people, products, vendors, customers, decisions, options, claims, invoices/observations, metrics) and the source documents behind it (Slack, email, meeting notes, KPI files). Sources are in English; write the query in English with the entity names as they appear (e.g. "Pipedrive invoice August 2025", "ConnectorCo pilot activations"). Returns matching entities with attributes, precomputed spend totals, and quoted passages with citation ids.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'English search query, specific: names, product, month, metric.' },
      entity_kind: { type: 'string', enum: ['person', 'organization', 'product', 'decision', 'option', 'claim', 'observation', 'metric', 'action', 'any'], description: 'Narrow entity matches to one kind. Default any.' },
    },
    required: ['query'],
  },
  async run(args) {
    const g = openGraph()
    const query = str(args.query, 300)
    const kind = str(args.entity_kind) || 'any'
    const nodes = g.searchNodes(query, 12).filter((n) => kind === 'any' || n.kind === kind)
    const words = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2)
    // Label and alias matching catches what full-text search misses (e.g. a product name in a different case).
    const { nodes: all } = g.getGraphSnapshot()
    for (const n of all) {
      if (nodes.some((x) => x.id === n.id) || (kind !== 'any' && n.kind !== kind)) continue
      const hay = `${n.label} ${n.aliases.join(' ')}`.toLowerCase()
      if (words.some((w) => hay.includes(w))) nodes.push(n)
    }
    const chunks = retrieveChunks(g, query, [])
    const entities = nodes.slice(0, 14).map((n) => `- ${n.id} [${n.kind}] ${n.label}${n.aliases.length ? ` (aka ${n.aliases.join(', ')})` : ''}${Object.entries(n.attributes).length ? ` {${Object.entries(n.attributes).map(([k, v]) => `${k}=${v}`).join('; ')}}` : ''}`)
    const totals = spendTotals(g)
    const citations = chunks.slice(0, 10).map((c, i) => ({ id: `C${i + 1}`, quote: c.text.length > 600 ? `${c.text.slice(0, 600)}…` : c.text, path: c.path, date: c.authoredAt }))
    const passages = citations.map((c) => `[${c.id}] ${c.path.replace(/^knowledge\/synthetic\//, '')}${c.date ? ` (${c.date})` : ''}\n${c.quote}`)
    const content = [
      entities.length ? `ENTITIES (${entities.length}):\n${entities.join('\n')}` : 'ENTITIES: none matched.',
      totals,
      passages.length ? `PASSAGES:\n${passages.join('\n\n')}` : 'PASSAGES: none matched. Try other words, the English product or person name, or list_entities.',
    ]
      .filter(Boolean)
      .join('\n\n')
    return { content, attachments: citations.length ? [{ type: 'citations', items: citations }] : [] }
  },
}

const listEntities: ToolDef = {
  name: 'list_entities',
  description: 'List every entity of one kind in the company graph (ids, labels, key attributes). Use it to discover what exists before searching, e.g. all products, all decisions, all people.',
  parameters: {
    type: 'object',
    properties: { kind: { type: 'string', enum: ['person', 'organization', 'product', 'decision', 'option', 'claim', 'observation', 'metric', 'action'] } },
    required: ['kind'],
  },
  async run(args) {
    const g = openGraph()
    const kind = str(args.kind)
    const nodes = g.getGraphSnapshot().nodes.filter((n) => n.kind === kind)
    if (!nodes.length) return { content: `No entities of kind ${kind}. Known kinds: ${[...new Set(g.getGraphSnapshot().nodes.map((n) => n.kind))].join(', ')}.` }
    return { content: nodes.map((n) => `- ${n.id}: ${n.label}${Object.entries(n.attributes).length ? ` {${Object.entries(n.attributes).map(([k, v]) => `${k}=${v}`).join('; ')}}` : ''}`).join('\n') }
  },
}

const getEntity: ToolDef = {
  name: 'get_entity',
  description: 'Everything the graph holds about one entity: attributes, its relations to other entities, and the quoted evidence behind it. Use the id from company_knowledge or list_entities.',
  parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  async run(args) {
    const g = openGraph()
    const id = str(args.id, 200)
    const node = g.getNode(id)
    if (!node) return { content: `No entity with id ${id}.` }
    const { nodes, edges } = g.getGraphSnapshot()
    const label = new Map(nodes.map((n) => [n.id, n.label]))
    const rel = edges.filter((e) => e.from === id || e.to === id).map((e) => (e.from === id ? `→ ${e.relation} → ${label.get(e.to) ?? e.to} (${e.to})` : `← ${e.relation} ← ${label.get(e.from) ?? e.from} (${e.from})`))
    const evidence = g.getNodeEvidence(id).slice(0, 8)
    const citations = evidence.map((e, i) => ({ id: `E${i + 1}`, quote: e.quote, path: e.chunk.path, date: e.chunk.authoredAt }))
    const content = [
      `${node.id} [${node.kind}] ${node.label}${node.aliases.length ? ` (aka ${node.aliases.join(', ')})` : ''}`,
      Object.entries(node.attributes).length ? `Attributes: ${Object.entries(node.attributes).map(([k, v]) => `${k}=${v}`).join('; ')}` : '',
      rel.length ? `Relations:\n${rel.join('\n')}` : 'Relations: none',
      citations.length ? `Evidence:\n${citations.map((c) => `[${c.id}] ${c.path.replace(/^knowledge\/synthetic\//, '')}${c.date ? ` (${c.date})` : ''}: "${c.quote}"`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    return { content, attachments: citations.length ? [{ type: 'citations', items: citations }] : [] }
  },
}

const findContact: ToolDef = {
  name: 'find_contact',
  description: `Look up a colleague's email address by name, in any Polish form ("Tomasza Kielara", "do Michała", "Kielar"). Always use this before draft_email when the room names a person instead of an address. Known people: ${DIRECTORY.map((p) => p.name).join(', ')}.`,
  parameters: { type: 'object', properties: { name: { type: 'string', description: 'The name as said, one or more people.' } }, required: ['name'] },
  async run(args) {
    const query = str(args.name, 200)
    const hits = findContacts(query)
    // People from the graph itself (seeded or extracted) that carry an email.
    const g = openGraph()
    const fromGraph = g
      .getGraphSnapshot()
      .nodes.filter((n) => n.kind === 'person' && n.attributes.email && !DIRECTORY.some((d) => d.id === n.id))
      .map((n) => ({ id: n.id, name: n.label, email: n.attributes.email!, role: n.attributes.role, aliases: n.aliases }))
    const more = findContacts(query, fromGraph)
    const all = [...hits, ...more]
    if (!all.length) return { content: `No contact matches "${query}". Known people with addresses: ${[...DIRECTORY, ...fromGraph].map((p) => `${p.name} <${p.email}>`).join(', ')}. Ask the room for the address if none fits.` }
    return { content: all.map((p) => `${p.name} <${p.email}>${p.role ? ` (${p.role})` : ''}`).join('\n') }
  },
}

// ---------- world ----------

export interface WebLookup {
  summary: string
  facts: string[]
  sources: WebSource[]
  model: string
  latencyMs: number
}

/** One web-searching model call; used by the agent tool and by the direct "ask_web" path. */
export async function webLookup(query: string): Promise<WebLookup> {
  const res = await chatJson<{ summary?: unknown; facts?: unknown }>({
    system: 'Use the web search results provided. Return only JSON: {"summary": string (2-4 sentences, Polish, with dates for time-sensitive facts), "facts": string[] (up to 6 concrete facts with their source domain in parentheses)}. Never say you lack access; the results are attached.',
    user: query,
    web: true,
    maxTokens: 600,
  })
  return { summary: str(res.data.summary, 1200), facts: list(res.data.facts, 6), sources: res.sources, model: res.model, latencyMs: res.latencyMs }
}

const searchWeb: ToolDef = {
  name: 'search_web',
  description: 'Search the public internet and read the results: news, market and exchange rates, regulations, competitors, public information about companies and products. Not for company-internal facts. Returns a short summary with the pages used.',
  parameters: { type: 'object', properties: { query: { type: 'string', description: 'What to look up, as a natural question or keywords. Polish or English.' } }, required: ['query'] },
  async run(args) {
    const res = await webLookup(str(args.query, 300))
    return { content: `${res.summary}\n${res.facts.map((f) => `- ${f}`).join('\n')}\nSources: ${res.sources.map((s) => s.url).join(', ') || 'none'}`, sources: res.sources }
  },
}

const pageScreenshot: ToolDef = {
  name: 'page_screenshot',
  description: `Open a web page in a headless browser and put a screenshot on the meeting screen. Use for "show our landing page", "how does X look now". If the room says "nasz landing" / "nasza strona" and no address is known, ask for it instead of guessing. The known landing page, if configured, is: ${process.env.LANDING_URL || '(not configured)'}.`,
  parameters: {
    type: 'object',
    properties: { url: { type: 'string', description: 'Full URL to open.' }, full_page: { type: 'boolean', description: 'Capture the whole page instead of the first screen. Default false.' } },
    required: ['url'],
  },
  async run(args) {
    const shot = await screenshotPage(str(args.url, 500), { fullPage: Boolean(args.full_page) })
    return { content: `Screenshot taken of ${shot.pageUrl} (title: "${shot.title}") in ${shot.tookMs} ms. It is now on the screen.`, attachments: [{ type: 'screenshot', url: shot.url, pageUrl: shot.pageUrl, title: shot.title }] }
  },
}

// ---------- producing things ----------

const draftEmail: ToolDef = {
  name: 'draft_email',
  description: `Prepare an email from ${ASSISTANT_NAME}'s mailbox. It is NOT sent by this tool: the draft appears on the screen and goes out only after someone in the room confirms ("${ASSISTANT_NAME}, wyślij" or the Wyślij button). Write the body in Polish unless asked otherwise, plain text, signed "${ASSISTANT_NAME}". When the room names a person, get the address with find_contact first; if no address can be found, ask for it rather than inventing one.`,
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses.' },
      subject: { type: 'string' },
      body: { type: 'string', description: 'Plain-text body.' },
    },
    required: ['to', 'subject', 'body'],
  },
  async run(args, ctx) {
    const to = list(args.to, 10).filter((a) => /@/.test(a))
    if (!to.length) return { content: 'No valid recipient address given. Ask the room for the address.' }
    const draft = addDraft(ctx.session, { to, subject: str(args.subject, 200), body: str(args.body, 6000) })
    return {
      content: `Draft ${draft.id} prepared to ${to.join(', ')}, subject "${draft.subject}". Mailbox ${mailConfigured() ? 'is' : 'is NOT'} configured. Tell the room it is on screen and waits for their confirmation.`,
      attachments: [{ type: 'email_draft', id: draft.id, to, subject: draft.subject, body: draft.body }],
    }
  },
}

const createDocument: ToolDef = {
  name: 'create_document',
  description: 'Write a document (memo, brief, summary, plan, email-ready text) in Markdown and keep it in the meeting session. It appears on the screen and can be downloaded. Use headings, bullets and tables; 150-600 words; only facts from the conversation and tool results.',
  parameters: { type: 'object', properties: { title: { type: 'string' }, markdown: { type: 'string' } }, required: ['title', 'markdown'] },
  async run(args, ctx) {
    const doc = addDocument(ctx.session, str(args.title, 120), str(args.markdown, 20000))
    return { content: `Document "${doc.title}" (${doc.id}) saved and shown on screen.`, attachments: [{ type: 'document', id: doc.id, title: doc.title, markdown: doc.markdown }] }
  },
}

const meetingNotes: ToolDef = {
  name: 'meeting_notes',
  description: 'Turn part of this meeting\'s transcript into structured notes: bullets, decisions, action items with owners, open questions. Scope "last_topic" = the most recent coherent topic, "whole" = the whole meeting, or give a topic keyword. The result is shown on screen as a note card.',
  parameters: {
    type: 'object',
    properties: { scope: { type: 'string', enum: ['last_topic', 'whole', 'topic'] }, topic: { type: 'string', description: 'When scope is topic: what the notes should be about.' } },
    required: ['scope'],
  },
  async run(args, ctx) {
    const scope = str(args.scope) || 'last_topic'
    const topic = str(args.topic, 200)
    const request = scope === 'whole' ? 'notatka z całego spotkania' : scope === 'topic' ? `notatka o: ${topic}` : 'punkty z ostatniego omawianego tematu'
    const note = await summarizeLines(ctx.session.lines, request)
    const content = [`Title: ${note.title}`, `Bullets:\n${note.bullets.map((b) => `- ${b}`).join('\n')}`, note.decisions.length ? `Decisions:\n${note.decisions.map((d) => `- ${d}`).join('\n')}` : '', note.actionItems.length ? `Action items:\n${note.actionItems.map((a) => `- ${a.who}: ${a.what}`).join('\n')}` : '', note.openQuestions.length ? `Open:\n${note.openQuestions.map((q) => `- ${q}`).join('\n')}` : ''].filter(Boolean).join('\n')
    return { content: `${content}\n(The note card is on screen.)`, attachments: [{ type: 'note', note }] }
  },
}

const chart: ToolDef = {
  name: 'chart',
  description: 'Draw a bar or line chart on the screen from numbers you already have (from the conversation or from tool results). Give real values only; never invent data points.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      kind: { type: 'string', enum: ['bar', 'line'] },
      unit: { type: 'string', description: 'e.g. EUR, PLN, %, szt.' },
      series: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, data: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' } }, required: ['label', 'value'] } } },
          required: ['name', 'data'],
        },
      },
    },
    required: ['title', 'kind', 'series'],
  },
  async run(args) {
    const raw = Array.isArray(args.series) ? (args.series as { name?: unknown; data?: unknown }[]) : []
    const series = raw
      .map((s) => ({
        name: str(s.name, 60) || 'Seria',
        data: (Array.isArray(s.data) ? (s.data as { label?: unknown; value?: unknown }[]) : []).map((d) => ({ label: str(d.label, 40), value: Number(d.value) })).filter((d) => d.label && Number.isFinite(d.value)).slice(0, 24),
      }))
      .filter((s) => s.data.length)
      .slice(0, 4)
    if (!series.length) return { content: 'No numeric data given; chart not drawn.' }
    const spec: ChartSpec = { title: str(args.title, 100) || 'Wykres', kind: str(args.kind) === 'line' ? 'line' : 'bar', unit: str(args.unit, 12) || undefined, series }
    return { content: `Chart "${spec.title}" drawn with ${series.length} series, ${series[0]!.data.length} points. It is on screen.`, attachments: [{ type: 'chart', spec }] }
  },
}

const writeReport: ToolDef = {
  name: 'write_report',
  description: 'Start writing a longer report (several sections, tables) in the background from the meeting transcript and company data. Returns at once with a task id; the room sees the task in the tray and gets the document when it is done (20-40 s). Use for "przygotuj raport", "zrób zestawienie na następne spotkanie".',
  parameters: { type: 'object', properties: { brief: { type: 'string', description: 'What the report should cover, in one or two sentences.' } }, required: ['brief'] },
  async run(args, ctx) {
    const task = startReportTask(str(args.brief, 600), ctx.session.lines)
    return { content: `Report task ${task.taskId} started in the background. Tell the room it will land in the tray when ready; do not wait for it.`, attachments: [{ type: 'task', task }] }
  },
}

export const TOOLS: ToolDef[] = [companyKnowledge, listEntities, getEntity, findContact, searchWeb, pageScreenshot, draftEmail, createDocument, meetingNotes, chart, writeReport]

export const toolByName = (name: string): ToolDef | undefined => TOOLS.find((t) => t.name === name)

/** Transcript excerpt for prompts. */
export const recentTranscript = (session: Session, n = 14): string => renderLines(session.lines.slice(-n), ASSISTANT_NAME)
