import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { KnowledgeGraph, summarizeSpend } from '../graph/index.ts'
import type { GraphNode, SourceChunk } from '../graph/index.ts'
import { ASSISTANT_NAME } from '../lib/wake-word.ts'
import { ensureDirectory } from './directory.ts'
import { chatJson, openrouterKey } from './llm.ts'

/**
 * Server-only: answers an open question from the whole company graph.
 *
 * The graph is small enough (tens of nodes, ~100 source chunks) that the model
 * can see every node and edge on every call; full-text search adds the most
 * relevant source passages with exact quotes. One fast LLM call (via
 * OpenRouter) composes a grounded Polish answer with citations.
 */

export interface Citation {
  id: string
  quote: string
  path: string
  heading: string
  date: string | null
  kind: SourceChunk['kind']
}

export interface GraphAnswer {
  question: string
  /** Short figure or name to show big, e.g. "1 224 EUR". Empty when none fits. */
  headline: string
  answer: string
  bullets: string[]
  citations: Citation[]
  confidence: 'high' | 'medium' | 'low'
  /** False when the graph has nothing on the question. */
  found: boolean
  model: string
  latencyMs: number
  retrieval: { nodes: number; edges: number; chunks: number }
  error?: string
}

/** One SQLite graph per company; a session names which one it is about. */
const GRAPHS: Record<string, string> = {
  aster: process.env.GRAPH_DB ?? 'knowledge/synthetic/demo-v3-2025-11-19.sqlite',
  bielsko: process.env.GRAPH_DB_BIELSKO ?? 'knowledge/bielsko/bielsko-ai.sqlite',
}
export const DEFAULT_COMPANY = 'aster'
export const COMPANIES = Object.keys(GRAPHS)
const MAX_CHUNKS = 14
const QUOTE_CHARS = 700

const graphs: Map<string, KnowledgeGraph> = ((globalThis as { __bolekGraphs?: Map<string, KnowledgeGraph> }).__bolekGraphs ??= new Map())
const digests = new WeakMap<KnowledgeGraph, { text: string; nodes: number; edges: number }>()

export function openGraph(company?: string | null): KnowledgeGraph {
  const key = company && GRAPHS[company] ? company : DEFAULT_COMPANY
  const cached = graphs.get(key)
  if (cached) return cached
  const path = resolve(process.cwd(), GRAPHS[key]!)
  if (!existsSync(path)) throw new Error(`Graph database not found at ${path}`)
  const graph = new KnowledgeGraph(path)
  ensureDirectory(graph)
  graphs.set(key, graph)
  return graph
}

const attrs = (n: GraphNode): string => {
  const entries = Object.entries(n.attributes).filter(([, v]) => v && v.length <= 160)
  return entries.length ? ` {${entries.map(([k, v]) => `${k}=${v}`).join('; ')}}` : ''
}

/** Every node and edge, compact, grouped by kind. Cached for the life of the process. */
export function graphDigest(g: KnowledgeGraph): { text: string; nodes: number; edges: number } {
  const cached = digests.get(g)
  if (cached) return cached
  const { nodes, edges } = g.getGraphSnapshot()
  const byKind = new Map<string, GraphNode[]>()
  for (const n of nodes) byKind.set(n.kind, [...(byKind.get(n.kind) ?? []), n])
  const label = new Map(nodes.map((n) => [n.id, n.label]))
  const lines: string[] = []
  for (const [kind, list] of [...byKind.entries()].sort()) {
    lines.push(`## ${kind} (${list.length})`)
    for (const n of list) {
      const alias = n.aliases.length ? ` (aka ${n.aliases.join(', ')})` : ''
      const flag = n.reviewStatus === 'disputed' ? ' [DISPUTED]' : ''
      lines.push(`- ${n.id}: ${n.label}${alias}${attrs(n)}${flag}`)
    }
  }
  lines.push(`## edges (${edges.length})`)
  for (const e of edges) lines.push(`- ${label.get(e.from) ?? e.from} —${e.relation}→ ${label.get(e.to) ?? e.to}`)
  const digest = { text: lines.join('\n'), nodes: nodes.length, edges: edges.length }
  digests.set(g, digest)
  return digest
}

/** Deterministic arithmetic for every metric, so the model quotes totals instead of adding. */
export function spendTotals(g: KnowledgeGraph): string {
  const metrics = g.getGraphSnapshot().nodes.filter((n) => n.kind === 'metric')
  const lines: string[] = []
  for (const m of metrics) {
    let summary
    try {
      summary = summarizeSpend(g, m.id, { from: '2000-01-01', to: '2100-01-01' })
    } catch {
      continue
    }
    if (!summary.observations.length) continue
    const byMonth = new Map<string, number>()
    for (const o of summary.observations) byMonth.set(o.observedAt.slice(0, 7), (byMonth.get(o.observedAt.slice(0, 7)) ?? 0) + o.value)
    lines.push(
      `- ${m.label} (${m.id}): total ${summary.total} ${summary.currency ?? ''} over ${summary.observations.length} observations; by month: ${[...byMonth.entries()]
        .sort()
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}; approvers: ${summary.approvers.map((a) => a.label).join(', ') || 'n/a'}; owners: ${summary.owners.map((o) => o.label).join(', ') || 'n/a'}`,
    )
  }
  return lines.length ? `## precomputed totals (trust these over your own arithmetic)\n${lines.join('\n')}` : ''
}

export function retrieveChunks(g: KnowledgeGraph, question: string, recent: string[]): SourceChunk[] {
  const seen = new Map<string, SourceChunk>()
  const add = (c: SourceChunk) => {
    if (!seen.has(c.id) && seen.size < MAX_CHUNKS) seen.set(c.id, c)
  }
  for (const hit of g.searchChunks(question, 10)) add(hit.chunk)
  // Evidence attached to the graph neighbourhood of the question.
  for (const e of g.buildDecisionContext(question, 20).evidence) add(e.chunk)
  // A follow-up ("and in August?") often only makes sense with the previous turn.
  const previous = recent.at(-1)
  if (previous && seen.size < MAX_CHUNKS) for (const hit of g.searchChunks(previous, 6)) add(hit.chunk)
  return [...seen.values()]
}

const systemPrompt = (company: string | null) => `You are ${ASSISTANT_NAME}, a live assistant on the screen of the board meeting of ${company ?? 'a Polish company'}. Someone in the room asked a question. Answer it from the GRAPH and SOURCES below only.

Rules:
- Answer in Polish, the way you would say it aloud in a meeting: short, concrete, numbers first.
- Use only facts present in GRAPH or SOURCES. Never invent amounts, dates or names. If the data does not contain the answer, set found=false and say so in one sentence, then say what the closest available fact is.
- Sums and counts: compute them from observation nodes or source passages and list which items you added.
- Dates in the data are ISO; say them the Polish way ("15 maja 2025").
- Cite sources by their [Cn] ids at the end of bullets. Only cite ids that exist.
- Keep "headline" to one figure or name (max 40 characters), or an empty string.

Return only JSON with this shape:
{"headline": string, "answer": string (1-3 sentences), "bullets": string[] (0-4 items), "citations": string[] (the [Cn] ids used, e.g. ["C2","C5"]), "confidence": "high"|"medium"|"low", "found": boolean}`

interface RawAnswer {
  headline?: unknown
  answer?: unknown
  bullets?: unknown
  citations?: unknown
  confidence?: unknown
  found?: unknown
}

export async function answerFromGraph(input: { question: string; recent?: string[]; company?: string | null }): Promise<GraphAnswer> {
  const started = performance.now()
  const g = openGraph(input.company)
  const digest = graphDigest(g)
  const chunks = retrieveChunks(g, input.question, input.recent ?? [])
  const citations: Citation[] = chunks.map((c, i) => ({
    id: `C${i + 1}`,
    quote: c.text.length > QUOTE_CHARS ? `${c.text.slice(0, QUOTE_CHARS)}…` : c.text,
    path: c.path,
    heading: c.heading,
    date: c.authoredAt,
    kind: c.kind,
  }))
  const base: Omit<GraphAnswer, 'headline' | 'answer' | 'bullets' | 'confidence' | 'found' | 'model'> = {
    question: input.question,
    citations: [],
    latencyMs: 0,
    retrieval: { nodes: digest.nodes, edges: digest.edges, chunks: chunks.length },
  }

  const key = openrouterKey()
  if (!key) {
    return {
      ...base,
      headline: '',
      answer: 'Brak klucza OpenRouter, więc nie mogę przeszukać danych firmy. Ustaw OPENROUTER_API_KEY.',
      bullets: [],
      confidence: 'low',
      found: false,
      model: 'none',
      latencyMs: Math.round(performance.now() - started),
      error: 'OPENROUTER_API_KEY missing',
    }
  }

  const sources = citations.map((c) => `[${c.id}] ${c.kind} · ${c.path}${c.heading ? ` › ${c.heading}` : ''}${c.date ? ` · ${c.date}` : ''}\n${c.quote}`).join('\n\n')
  const context = input.recent?.length ? `EARLIER TURNS (for context only):\n${input.recent.map((t) => `- ${t}`).join('\n')}\n\n` : ''
  const totals = spendTotals(g)
  const user = `${context}QUESTION: ${input.question}\n\nGRAPH:\n${digest.text}\n${totals ? `\n${totals}\n` : ''}\nSOURCES:\n${sources}`

  const company = g.getGraphSnapshot().nodes.find((n) => n.kind === 'organization' && n.attributes.role === 'company')?.label ?? null
  const res = await chatJson<RawAnswer>({ system: systemPrompt(company), user, maxTokens: 600, timeoutMs: 20000 })
  const raw = res.data

  const used = new Set(Array.isArray(raw.citations) ? raw.citations.map((c) => String(c).replace(/[[\]]/g, '')) : [])
  const bulletText = Array.isArray(raw.bullets) ? raw.bullets.map(String) : []
  for (const b of [...bulletText, String(raw.answer ?? '')]) for (const m of b.matchAll(/\[(C\d+)\]/g)) used.add(m[1]!)
  const confidence = raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low' ? raw.confidence : 'medium'

  return {
    ...base,
    headline: String(raw.headline ?? '').slice(0, 60),
    answer: String(raw.answer ?? '').trim() || 'Nie udało się ułożyć odpowiedzi.',
    bullets: bulletText.slice(0, 4),
    citations: citations.filter((c) => used.has(c.id)),
    confidence,
    found: raw.found !== false,
    model: res.model,
    latencyMs: Math.round(performance.now() - started),
  }
}
