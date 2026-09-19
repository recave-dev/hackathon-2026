import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { KnowledgeGraph } from '@/graph/index.ts'
import type { DecisionContext, EvidenceItem, GraphNode, SourceDocument } from '@/graph/index.ts'

/** Server-only: reads the company graph and shapes it for a decision draft. */

export type BundleNode = { id: string; kind: GraphNode['kind']; label: string; attributes: Record<string, string>; disputed: boolean }

export interface BundleEvidence {
  id: string
  chunkId: string
  kind: SourceDocument['kind']
  path: string
  heading: string
  date: string | null
  line: number
  quote: string
  role: EvidenceItem['role']
  /** True when the chunk itself matched the question, not only a neighbour in the graph. */
  direct: boolean
}

export interface DraftBundle {
  question: string
  anchors: BundleNode[]
  people: BundleNode[]
  organizations: BundleNode[]
  products: BundleNode[]
  priorDecisions: BundleNode[]
  /** Options together with the decision that considered them. */
  options: (BundleNode & { decisionLabel?: string })[]
  claims: BundleNode[]
  observations: BundleNode[]
  metrics: BundleNode[]
  actions: BundleNode[]
  evidence: BundleEvidence[]
  stats: { searchedSources: number; nodes: number; edges: number; documents: number }
}

const GRAPH_PATH = process.env.GRAPH_DB ?? 'knowledge/synthetic/demo-v3-2025-11-19.sqlite'

let graph: KnowledgeGraph | undefined
function openGraph(): KnowledgeGraph {
  if (graph) return graph
  const path = resolve(process.cwd(), GRAPH_PATH)
  if (!existsSync(path)) throw new Error(`Graph database not found at ${path}`)
  graph = new KnowledgeGraph(path)
  return graph
}

const toNode = (n: GraphNode): BundleNode => ({
  id: n.id,
  kind: n.kind,
  label: n.label,
  attributes: n.attributes,
  disputed: n.reviewStatus === 'disputed',
})

const byDateDesc = (a: BundleNode, b: BundleNode): number =>
  (b.attributes.decided_at ?? b.attributes.date ?? '').localeCompare(a.attributes.decided_at ?? a.attributes.date ?? '')

export function retrieveDraftBundle(question: string): DraftBundle {
  const g = openGraph()
  const ctx: DecisionContext = g.buildDecisionContext(question, 24)
  const directChunks = new Set(g.searchChunks(question, 12).map((h) => h.chunk.id))
  const byId = new Map(ctx.nodes.map((n) => [n.id, n]))
  const pick = (kind: GraphNode['kind']): BundleNode[] => ctx.nodes.filter((n) => n.kind === kind).map(toNode)

  const options = pick('option').map((o) => {
    const edge = ctx.edges.find((e) => e.relation === 'considers' && e.to === o.id)
    return { ...o, decisionLabel: edge ? byId.get(edge.from)?.label : undefined }
  })

  const evidence: BundleEvidence[] = ctx.evidence.map((e, i) => ({
    id: `ev-${i}-${e.chunk.id}`,
    chunkId: e.chunk.id,
    kind: e.chunk.kind,
    path: e.chunk.path,
    heading: e.chunk.heading,
    date: e.chunk.authoredAt,
    line: e.quoteStartLine,
    quote: e.quote,
    role: e.role,
    direct: directChunks.has(e.chunk.id),
  }))

  return {
    question,
    anchors: ctx.anchors.map(toNode),
    people: pick('person'),
    organizations: pick('organization'),
    products: pick('product'),
    priorDecisions: pick('decision').sort(byDateDesc),
    options,
    claims: pick('claim'),
    observations: pick('observation'),
    metrics: pick('metric'),
    actions: pick('action'),
    evidence,
    stats: {
      searchedSources: ctx.searchedSources,
      nodes: ctx.nodes.length,
      edges: ctx.edges.length,
      documents: g.listDocuments().length,
    },
  }
}
