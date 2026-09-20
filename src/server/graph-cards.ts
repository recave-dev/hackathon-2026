import type { Facet } from '../demo/knowledge.ts'
import { summarizeSpend, type KnowledgeGraph } from '../graph/index.ts'
import type { GraphEdge, GraphNode, NodeKind } from '../graph/index.ts'
import { openGraph } from './graph-answer.ts'

/**
 * Server-only: cards straight from the company graph, no language model.
 *
 * Two things live here. The catalog is what Jev chooses from (topics: products,
 * vendors, customers, decisions, metrics; people), built from the graph so the
 * router never sees hand-written demo data. The card builders take the entity
 * Jev picked and the angle the room asked about (cost, owner, deadline, status,
 * history, options) and render the answer deterministically from nodes, edges,
 * attributes and quoted evidence. That is what makes the common questions fast:
 * a Jev call, then arithmetic over the graph, and the card is on screen.
 */

export const TOPIC_KINDS: NodeKind[] = ['product', 'organization', 'decision', 'metric', 'project', 'customer_segment']

export interface CatalogTopic {
  id: string
  kind: NodeKind
  label: string
  /** Short Polish subtitle for the tray and the card header. */
  subtitle: string
  /** English criterion for the Jev choice question. */
  hint: string
  /** Lower-case names for the offline matcher. */
  aliases: string[]
}

export interface CatalogPerson {
  id: string
  label: string
  role?: string
  hint: string
  aliases: string[]
}

export interface GraphCatalog {
  company: string | null
  topics: CatalogTopic[]
  people: CatalogPerson[]
}

export interface GraphCitation {
  id: string
  quote: string
  path: string
  date: string | null
  kind: string
}

export interface CardFact {
  label: string
  value: string
  hint?: string
  /** Facets this figure answers; the first matching fact is shown biggest. */
  facets: Facet[]
}

export type CardEventKind = 'approved' | 'rejected' | 'decision' | 'open' | 'deadline' | 'request' | 'note'

export interface CardEvent {
  at: string | null
  kind: CardEventKind
  title: string
  detail?: string
  who?: string
  amount?: string
}

export interface CardPerson {
  id: string
  label: string
  name: string
  role?: string
}

export interface CardOption {
  id: string
  label: string
  selected: boolean
  decision: string
}

export interface SpendSeries {
  metric: string
  total: number
  currency: string
  count: number
  from: string
  to: string
  byMonth: { month: string; value: number }[]
}

export interface TopicCard {
  kind: 'topic'
  id: string
  entityKind: NodeKind
  title: string
  subtitle: string
  facet: Facet
  /** One figure, name or date for the big print; empty when none fits. */
  headline: string
  /** One or two deterministic Polish sentences for the facet. */
  answer: string
  facts: CardFact[]
  people: CardPerson[]
  timeline: CardEvent[]
  options: CardOption[]
  open: string[]
  spend?: SpendSeries
  citations: GraphCitation[]
  /** False when the graph holds nothing beyond the entity itself. */
  found: boolean
  latencyMs: number
}

export interface PersonCard {
  kind: 'person'
  id: string
  name: string
  role?: string
  email?: string
  facts: CardFact[]
  /** What they decide, approve, own or requested. */
  owns: string[]
  /** Topics they touch, for jumping to a topic card. */
  topics: { id: string; label: string }[]
  recent: CardEvent[]
  citations: GraphCitation[]
  latencyMs: number
}

export type GraphCard = TopicCard | PersonCard

// ---------- helpers ----------

export const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')

const plDate = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

const MONTHS_GENITIVE = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']

/** "od czerwca 2025": month in the genitive, as it reads after "od" / "do". */
const plMonth = (yyyyMm: string): string => {
  const m = Number(yyyyMm.slice(5, 7))
  const name = MONTHS_GENITIVE[m - 1]
  return name ? `${name} ${yyyyMm.slice(0, 4)}` : yyyyMm
}

const money = (value: number, currency: string): string => `${value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ${currency}`.trim()

const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return `${n} ${one}`
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

const STATUS_PL: Record<string, string> = { approved: 'zatwierdzona', rejected: 'odrzucona', open: 'otwarta', deferred: 'odłożona', done: 'zrobione', unknown: 'nieznany' }
const plStatus = (s: string | undefined): string => (s ? (STATUS_PL[s] ?? s) : 'nieznany')

const ORG_ROLE_PL: Record<string, string> = { customer: 'Klient', vendor: 'Dostawca', partner: 'Partner', company: 'Firma' }
const KIND_PL: Record<string, string> = { product: 'Produkt / narzędzie', organization: 'Organizacja', decision: 'Decyzja', metric: 'Wskaźnik', project: 'Projekt', customer_segment: 'Segment klientów', person: 'Osoba' }

const KIND_EN: Record<string, string> = { product: 'Product or tool', organization: 'Organization', decision: 'Decision', metric: 'Metric', project: 'Project', customer_segment: 'Customer segment' }
const ORG_ROLE_EN: Record<string, string> = { customer: 'Customer', vendor: 'Vendor or partner', partner: 'Partner', company: 'The company itself' }

const isDate = (v: string | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}/.test(v))

// ---------- catalog ----------

const catalogs = new WeakMap<KnowledgeGraph, GraphCatalog>()

export function topicSubtitle(n: GraphNode): string {
  const a = n.attributes
  if (n.kind === 'organization') return ORG_ROLE_PL[a.role ?? ''] ?? KIND_PL.organization!
  if (n.kind === 'product') return [KIND_PL.product, a.category, a.vendor && a.vendor !== n.label ? `od ${a.vendor}` : ''].filter(Boolean).join(' · ')
  if (n.kind === 'decision') return [KIND_PL.decision, plStatus(a.status), a.decided_at ? plDate(a.decided_at) : ''].filter(Boolean).join(' · ')
  if (n.kind === 'metric') return [KIND_PL.metric, a.unit ? `w ${a.unit}` : ''].filter(Boolean).join(' · ')
  return KIND_PL[n.kind] ?? n.kind
}

function topicHint(n: GraphNode): string {
  const a = n.attributes
  const aka = n.aliases.length ? ` (also called: ${n.aliases.join(', ')})` : ''
  const attrs = Object.entries(a)
    .filter(([k, v]) => v && v.length <= 80 && !['source'].includes(k))
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join('; ')
  const head = n.kind === 'organization' ? (ORG_ROLE_EN[a.role ?? ''] ?? KIND_EN.organization) : (KIND_EN[n.kind] ?? n.kind)
  return `${head} "${n.label}"${aka}${attrs ? `; ${attrs}` : ''}.`
}

/** What Jev chooses from, derived from the graph; cached per graph instance. */
export function graphCatalog(g: KnowledgeGraph = openGraph()): GraphCatalog {
  const cached = catalogs.get(g)
  if (cached) return cached
  const { nodes } = g.getGraphSnapshot()
  const companyNode = nodes.find((n) => n.kind === 'organization' && n.attributes.role === 'company')
  const topics: CatalogTopic[] = nodes
    .filter((n) => TOPIC_KINDS.includes(n.kind) && n.id !== companyNode?.id)
    .map((n) => ({ id: n.id, kind: n.kind, label: n.label, subtitle: topicSubtitle(n), hint: topicHint(n), aliases: [n.label, ...n.aliases].map(fold) }))
  const people: CatalogPerson[] = nodes
    .filter((n) => n.kind === 'person')
    .map((n) => ({
      id: n.id,
      label: n.label,
      role: n.attributes.role,
      hint: `${n.label}${n.attributes.role ? `, ${n.attributes.role}` : ''}${n.aliases.length ? ` (also: ${n.aliases.join(', ')})` : ''}${n.attributes.approves ? `; approves ${n.attributes.approves}` : ''}.`,
      aliases: [n.label, ...n.aliases].map(fold),
    }))
  const catalog = { company: companyNode?.label ?? null, topics, people }
  catalogs.set(g, catalog)
  return catalog
}

/** Catalog without the Jev hints, for the browser (tray titles, debug labels). */
export function publicCatalog(g: KnowledgeGraph = openGraph()): { company: string | null; topics: { id: string; kind: NodeKind; label: string; subtitle: string }[]; people: { id: string; label: string; role?: string }[] } {
  const c = graphCatalog(g)
  return { company: c.company, topics: c.topics.map(({ id, kind, label, subtitle }) => ({ id, kind, label, subtitle })), people: c.people.map(({ id, label, role }) => ({ id, label, role })) }
}

/** The product or organization a metric or decision is about, when there is exactly one; the room usually means that. */
export function parentTopic(g: KnowledgeGraph, id: string): string | null {
  const self = g.getNode(id)
  if (!self || (self.kind !== 'metric' && self.kind !== 'decision')) return null
  const { nodes, edges } = g.getGraphSnapshot()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parents = new Set<string>()
  const aboutOf = (decisionId: string) => {
    for (const e of edges) if (e.from === decisionId && e.relation === 'about') {
      const n = byId.get(e.to)
      if (n && (n.kind === 'product' || n.kind === 'organization')) parents.add(n.id)
    }
  }
  if (self.kind === 'decision') aboutOf(self.id)
  else for (const e of edges) if (e.to === self.id && e.relation === 'targets') aboutOf(e.from)
  return parents.size === 1 ? [...parents][0]! : null
}

// ---------- neighbourhood ----------

interface Hood {
  self: GraphNode
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  byId: Map<string, GraphNode>
}

const EXPAND_KINDS = new Set<NodeKind>(['decision', 'action', 'metric'])

/** The entity, what is linked to it, and what explains those links (claims, options, people, observations). */
function neighbourhood(g: KnowledgeGraph, self: GraphNode): Hood {
  const { nodes, edges } = g.getGraphSnapshot()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const picked = new Map<string, GraphNode>([[self.id, self]])
  const pickedEdges: GraphEdge[] = []
  const seenEdge = new Set<string>()
  const seeds = [self.id]
  if (self.kind === 'organization') {
    // Vendors reach their products, customers their requests, through attributes rather than edges.
    for (const n of nodes) {
      if (n.kind === 'product' && n.attributes.vendor && fold(n.attributes.vendor) === fold(self.label)) {
        picked.set(n.id, n)
        seeds.push(n.id)
      }
      if (n.kind === 'claim' && n.attributes.customer && fold(n.attributes.customer) === fold(self.label)) {
        picked.set(n.id, n)
        seeds.push(n.id)
      }
    }
  }
  const expanded = new Set<string>()
  let frontier = seeds
  for (let round = 0; round < 3 && frontier.length; round++) {
    const next: string[] = []
    for (const id of frontier) {
      if (expanded.has(id)) continue
      expanded.add(id)
      for (const e of edges) {
        if (e.from !== id && e.to !== id) continue
        if (!seenEdge.has(e.id)) {
          seenEdge.add(e.id)
          pickedEdges.push(e)
        }
        const other = e.from === id ? e.to : e.from
        if (picked.has(other)) continue
        const n = byId.get(other)
        if (!n) continue
        picked.set(other, n)
        if (EXPAND_KINDS.has(n.kind)) next.push(other)
      }
    }
    frontier = next
  }
  return { self, nodes: picked, edges: pickedEdges, byId }
}

const ofKind = (h: Hood, kind: NodeKind): GraphNode[] => [...h.nodes.values()].filter((n) => n.kind === kind)

// ---------- events, people, options ----------

function eventsOf(h: Hood): CardEvent[] {
  const events: CardEvent[] = []
  const optionLabel = (id: string | undefined) => (id ? (h.byId.get(id)?.label ?? id) : '')
  for (const n of h.nodes.values()) {
    const a = n.attributes
    if (n.kind === 'decision') {
      const kind: CardEventKind = a.status === 'approved' ? 'approved' : a.status === 'rejected' ? 'rejected' : a.status === 'open' ? 'open' : 'decision'
      const detail = [
        a.approver ? `zatwierdza: ${a.approver}` : '',
        a.requested_by ? `wnioskował: ${a.requested_by}` : '',
        a.monthly_cap_eur ? `limit ${a.monthly_cap_eur} EUR/mies.` : '',
        a.seats ? `${a.seats} miejsc` : '',
        a.selected_option ? `wybrano: ${optionLabel(a.selected_option)}` : '',
        a.revisit_at ? `powrót ${plDate(a.revisit_at)}` : '',
        a.review_at ? `przegląd ${plDate(a.review_at)}` : '',
        a.revisit_condition ? `warunek: ${a.revisit_condition}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      events.push({ at: a.decided_at ?? a.opened_at ?? null, kind, title: n.label, detail: detail || undefined, who: a.approver ?? a.owner })
    } else if (n.kind === 'claim') {
      const ck = a.claim_kind ?? ''
      const at = a.decided_at ?? a.due_at ?? null
      const kind: CardEventKind = ck === 'decision_record' ? (a.status === 'approved' ? 'approved' : a.status === 'rejected' ? 'rejected' : 'decision') : ck.endsWith('_request') ? 'request' : ck === 'kpi_target' ? 'deadline' : 'note'
      const amount = a.monthly_cost_eur ? `${a.monthly_cost_eur} EUR/mies.` : a.monthly_cap_eur ? `limit ${a.monthly_cap_eur} EUR` : undefined
      const detail = [a.customer ? `klient: ${a.customer}` : '', a.evidence_status ? `dowód: ${a.evidence_status.replace(/_/g, ' ')}` : '', a.revisit_condition ? `warunek: ${a.revisit_condition}` : '', a.forecast ? `prognoza ${a.forecast}, wynik ${a.actual}` : '']
        .filter(Boolean)
        .join(' · ')
      events.push({ at, kind, title: n.label, detail: detail || undefined, who: a.approver ?? a.requested_by, amount })
    } else if (n.kind === 'observation') {
      const amount = a.value ? `${Number(a.value).toLocaleString('pl-PL')} ${a.currency ?? ''}`.trim() : undefined
      events.push({ at: a.observed_at ?? null, kind: 'note', title: n.label, detail: a.target ? `cel: ${a.target}` : a.invoice ? `faktura ${a.invoice}${a.seats ? `, ${a.seats} miejsc` : ''}` : undefined, amount })
    } else if (n.kind === 'action') {
      events.push({ at: a.due_at ?? null, kind: a.status === 'open' ? 'deadline' : 'note', title: n.label, detail: a.status ? `status: ${plStatus(a.status)}` : undefined, who: a.owner })
    }
  }
  events.sort((x, y) => (x.at ?? '9999').localeCompare(y.at ?? '9999'))
  return events
}

function peopleOf(h: Hood): CardPerson[] {
  const out: CardPerson[] = []
  const add = (p: GraphNode, label: string) => {
    if (out.some((o) => o.id === p.id && o.label === label)) return
    out.push({ id: p.id, label, name: p.label, role: p.attributes.role })
  }
  const byName = (name: string | undefined) => (name ? [...h.byId.values()].find((n) => n.kind === 'person' && fold(n.label) === fold(name)) : undefined)
  for (const n of h.nodes.values()) {
    if (n.kind !== 'decision' && n.kind !== 'action') continue
    const owner = byName(n.attributes.owner)
    if (owner) add(owner, 'Właściciel')
    const approver = byName(n.attributes.approver)
    if (approver) add(approver, 'Zatwierdza')
    const requester = byName(n.attributes.requested_by)
    if (requester) add(requester, 'Wnioskował')
  }
  for (const e of h.edges) {
    if (e.relation !== 'assigned_to') continue
    const from = h.byId.get(e.from)
    const person = h.byId.get(e.to)
    if (!from || !person || person.kind !== 'person') continue
    if (from.kind === 'action') add(person, 'Właściciel')
    else if (from.kind === 'decision') add(person, from.attributes.approver && fold(from.attributes.approver) === fold(person.label) ? 'Zatwierdza' : 'Decyduje')
  }
  const order = ['Właściciel', 'Zatwierdza', 'Decyduje', 'Wnioskował']
  return out.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
}

function optionsOf(h: Hood): CardOption[] {
  const out: CardOption[] = []
  for (const e of h.edges) {
    if (e.relation !== 'considers') continue
    const decision = h.byId.get(e.from)
    const option = h.byId.get(e.to)
    if (!decision || !option) continue
    out.push({ id: option.id, label: option.label, selected: decision.attributes.selected_option === option.id, decision: decision.label })
  }
  return out
}

function spendOf(g: KnowledgeGraph, h: Hood): SpendSeries | undefined {
  for (const m of ofKind(h, 'metric')) {
    let s
    try {
      s = summarizeSpend(g, m.id, { from: '2000-01-01', to: '2100-01-01' })
    } catch {
      continue
    }
    if (!s.observations.length || !s.currency) continue
    const byMonth = new Map<string, number>()
    for (const o of s.observations) byMonth.set(o.observedAt.slice(0, 7), (byMonth.get(o.observedAt.slice(0, 7)) ?? 0) + o.value)
    return {
      metric: m.label,
      total: s.total,
      currency: s.currency,
      count: s.observations.length,
      from: s.observations[0]!.observedAt,
      to: s.observations.at(-1)!.observedAt,
      byMonth: [...byMonth.entries()].sort().map(([month, value]) => ({ month, value: Math.round(value * 100) / 100 })),
    }
  }
  return undefined
}

interface Deadline {
  at: string
  what: string
}

function deadlinesOf(h: Hood): Deadline[] {
  const out: Deadline[] = []
  const KEYS: [string, string][] = [
    ['due_at', 'termin'],
    ['review_at', 'przegląd'],
    ['revisit_at', 'powrót do tematu'],
    ['effective_at', 'obowiązuje od'],
    ['starts_at', 'start'],
  ]
  for (const n of h.nodes.values()) {
    for (const [key, word] of KEYS) {
      const v = n.attributes[key]
      if (isDate(v)) out.push({ at: v.slice(0, 10), what: `${word}: ${n.label}` })
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

function citationsOf(g: KnowledgeGraph, h: Hood, max = 8): GraphCitation[] {
  const seen = new Map<string, GraphCitation>()
  const add = (quote: string, chunk: { id: string; path: string; authoredAt: string | null; kind: string }) => {
    if (seen.size >= max || seen.has(chunk.id)) return
    seen.set(chunk.id, { id: '', quote: quote.length > 600 ? `${quote.slice(0, 600)}…` : quote, path: chunk.path, date: chunk.authoredAt, kind: chunk.kind })
  }
  for (const e of g.getNodeEvidence(h.self.id)) add(e.quote, e.chunk)
  for (const d of [...ofKind(h, 'decision'), ...ofKind(h, 'action')]) for (const e of g.getNodeEvidence(d.id).slice(0, 1)) add(e.quote, e.chunk)
  for (const hit of g.searchChunks([h.self.label, ...h.self.aliases].join(' '), 4)) add(hit.chunk.text, hit.chunk)
  return [...seen.values()].map((c, i) => ({ ...c, id: `C${i + 1}` }))
}

// ---------- topic card ----------

export function buildTopicCard(g: KnowledgeGraph, id: string, facet: Facet): TopicCard | null {
  const started = performance.now()
  const self = g.getNode(id)
  if (!self) return null
  const h = neighbourhood(g, self)
  const decisions = ofKind(h, 'decision').filter((d) => d.id !== self.id)
  const allDecisions = self.kind === 'decision' ? [self, ...decisions] : decisions
  const claims = ofKind(h, 'claim')
  const observations = ofKind(h, 'observation').sort((a, b) => (a.attributes.observed_at ?? '').localeCompare(b.attributes.observed_at ?? ''))
  const actions = ofKind(h, 'action')
  const people = peopleOf(h)
  const options = optionsOf(h)
  const timeline = eventsOf(h)
  const spend = spendOf(g, h)
  const deadlines = deadlinesOf(h)
  const citations = citationsOf(g, h)

  const facts: CardFact[] = []
  const cap = allDecisions.map((d) => Number(d.attributes.monthly_cap_eur)).filter(Number.isFinite)
  if (spend) {
    const last = spend.byMonth.at(-1)!
    facts.push({ label: 'Łącznie', value: money(spend.total, spend.currency), hint: `${plural(spend.count, 'faktura', 'faktury', 'faktur')} od ${plMonth(spend.byMonth[0]!.month)} do ${plMonth(last.month)}`, facets: ['cost', 'general'] })
    facts.push({ label: 'Ostatnio miesięcznie', value: money(last.value, spend.currency), hint: plMonth(last.month), facets: ['cost', 'status'] })
  }
  if (cap.length) facts.push({ label: 'Limit miesięczny', value: `${Math.max(...cap)} EUR`, hint: 'z decyzji zakupowej', facets: ['cost', 'owner'] })
  const lastSeats = [...observations].reverse().find((o) => o.attributes.seats)?.attributes.seats ?? [...allDecisions].reverse().find((d) => d.attributes.seats)?.attributes.seats
  if (lastSeats) facts.push({ label: 'Miejsca', value: lastSeats, facets: ['cost', 'status'] })
  const requested = claims.filter((c) => c.attributes.monthly_cost_eur)
  if (!spend && requested.length) {
    const r = requested.at(-1)!
    facts.push({ label: 'Wnioskowany koszt', value: `${r.attributes.monthly_cost_eur} EUR/mies.`, hint: r.label, facets: ['cost'] })
  }
  const withTarget = [...observations].reverse().find((o) => o.attributes.target && o.attributes.value)
  if (withTarget) facts.push({ label: 'Wynik', value: `${withTarget.attributes.value} z ${withTarget.attributes.target}`, hint: plDate(withTarget.attributes.observed_at), facets: ['status', 'general'] })
  if (self.kind === 'decision') facts.push({ label: 'Status', value: plStatus(self.attributes.status), hint: self.attributes.decided_at ? plDate(self.attributes.decided_at) : self.attributes.review_at ? `przegląd ${plDate(self.attributes.review_at)}` : undefined, facets: ['status', 'general'] })
  if (allDecisions.length) {
    const count = (s: string) => allDecisions.filter((d) => d.attributes.status === s).length
    facts.push({ label: 'Decyzje', value: String(allDecisions.length), hint: [count('approved') ? `${count('approved')} zatw.` : '', count('rejected') ? `${count('rejected')} odrzuc.` : '', count('open') ? `${count('open')} otwarte` : ''].filter(Boolean).join(', ') || undefined, facets: ['history', 'general', 'status'] })
  }
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = deadlines.find((d) => d.at >= today)
  const latestDeadline = deadlines.at(-1)
  const keyDeadline = upcoming ?? latestDeadline
  if (keyDeadline) facts.push({ label: upcoming ? 'Najbliższy termin' : 'Ostatni termin', value: plDate(keyDeadline.at), hint: keyDeadline.what, facets: ['deadline', 'general'] })
  if (options.length) facts.push({ label: 'Opcje', value: String(options.length), hint: options.find((o) => o.selected) ? `wybrano: ${options.find((o) => o.selected)!.label}` : 'bez wyboru', facets: ['options'] })
  if (people[0]) facts.push({ label: people[0].label, value: people[0].name, hint: people[0].role, facets: ['owner'] })

  const open: string[] = []
  for (const a of actions) if (a.attributes.status === 'open') open.push(`${a.label}${a.attributes.owner ? ` (${a.attributes.owner}${a.attributes.due_at ? `, do ${plDate(a.attributes.due_at)}` : ''})` : ''}`)
  for (const d of allDecisions) if (d.attributes.status === 'open') open.push(`${d.label}${d.attributes.review_at ? ` (przegląd ${plDate(d.attributes.review_at)})` : ''}`)
  for (const d of allDecisions) if (d.attributes.status === 'rejected' && d.attributes.revisit_at) open.push(`${d.label}: wracamy ${plDate(d.attributes.revisit_at)}`)
  for (const c of claims) if (c.attributes.revisit_condition && !allDecisions.some((d) => d.attributes.revisit_condition === c.attributes.revisit_condition)) open.push(`${c.label}: ${c.attributes.revisit_condition}`)

  let headline = ''
  let answer = ''
  const dated = timeline.filter((e) => e.at)
  switch (facet) {
    case 'cost':
      if (spend) {
        const last = spend.byMonth.at(-1)!
        headline = money(spend.total, spend.currency)
        answer = `Łącznie ${money(spend.total, spend.currency)} za ${plural(spend.count, 'fakturę', 'faktury', 'faktur')} od ${plMonth(spend.byMonth[0]!.month)} do ${plMonth(last.month)}, ostatnio ${money(last.value, spend.currency)} miesięcznie${cap.length ? `, limit ${Math.max(...cap)} EUR` : ''}.`
      } else if (requested.length) {
        const r = requested.at(-1)!
        headline = `${r.attributes.monthly_cost_eur} EUR/mies.`
        answer = `Wnioskowany koszt: ${r.label}.${allDecisions[0] ? ` Decyzja: ${plStatus(allDecisions[0].attributes.status)}${allDecisions[0].attributes.decided_at ? ` ${plDate(allDecisions[0].attributes.decided_at)}` : ''}.` : ''}`
      } else answer = 'W danych firmy nie ma kwot dla tego tematu.'
      break
    case 'owner':
      if (people.length) {
        headline = people[0]!.name
        answer = `${people
          .slice(0, 3)
          .map((p) => `${p.label}: ${p.name}${p.role ? ` (${p.role})` : ''}`)
          .join('. ')}.`
      } else answer = 'W danych firmy nie ma przypisanej osoby.'
      break
    case 'deadline':
      if (deadlines.length) {
        headline = plDate(keyDeadline!.at)
        const list = (upcoming ? deadlines.filter((d) => d.at >= today) : [...deadlines].reverse()).slice(0, 3)
        answer = `${upcoming ? 'Najbliżej' : 'Ostatnio'}: ${list.map((d) => `${plDate(d.at)} ${d.what}`).join('; ')}.`
      } else answer = 'W danych firmy nie ma terminów dla tego tematu.'
      break
    case 'status':
      if (self.kind === 'decision') {
        headline = plStatus(self.attributes.status)
        answer = `Decyzja ${plStatus(self.attributes.status)}${self.attributes.decided_at ? ` ${plDate(self.attributes.decided_at)}` : ''}${self.attributes.selected_option ? `, wybrano: ${h.byId.get(self.attributes.selected_option)?.label ?? self.attributes.selected_option}` : ''}${self.attributes.review_at ? `, przegląd ${plDate(self.attributes.review_at)}` : ''}.`
      } else if (withTarget) {
        headline = `${withTarget.attributes.value} z ${withTarget.attributes.target}`
        answer = `${withTarget.label} (${plDate(withTarget.attributes.observed_at)}).`
      } else if (allDecisions.length) {
        const d = [...allDecisions].sort((a, b) => (b.attributes.decided_at ?? '').localeCompare(a.attributes.decided_at ?? ''))[0]!
        headline = plStatus(d.attributes.status)
        answer = `Ostatnia decyzja: ${d.label}, ${plStatus(d.attributes.status)}${d.attributes.decided_at ? ` ${plDate(d.attributes.decided_at)}` : ''}.`
      } else answer = 'W danych firmy nie ma stanu dla tego tematu.'
      break
    case 'history':
      if (dated.length) {
        headline = plural(dated.length, 'zdarzenie', 'zdarzenia', 'zdarzeń')
        const first = dated[0]!
        const last = dated.at(-1)!
        answer = dated.length > 1 ? `Od ${plDate(first.at)}: ${first.title}. Ostatnio ${plDate(last.at)}: ${last.title}.` : `${plDate(first.at)}: ${first.title}.`
      } else answer = 'W danych firmy nie ma historii tego tematu.'
      break
    case 'options':
      if (options.length) {
        headline = plural(options.length, 'opcja', 'opcje', 'opcji')
        answer = `${options.map((o) => `${o.label}${o.selected ? ' (wybrana)' : ''}`).join('; ')}.`
      } else answer = 'W danych firmy nie ma rozważanych opcji dla tego tematu.'
      break
    default: {
      headline = self.label
      const bits = [
        topicSubtitle(self),
        allDecisions.length ? plural(allDecisions.length, 'decyzja', 'decyzje', 'decyzji') : '',
        spend ? `wydatki ${money(spend.total, spend.currency)}` : '',
        people[0] ? `${people[0].label.toLowerCase()}: ${people[0].name}` : '',
      ].filter(Boolean)
      answer = `${bits.join(' · ')}.`
    }
  }

  return {
    kind: 'topic',
    id: self.id,
    entityKind: self.kind,
    title: self.label,
    subtitle: topicSubtitle(self),
    facet,
    headline,
    answer,
    facts,
    people,
    timeline: timeline.slice(-16),
    options,
    open,
    spend,
    citations,
    found: h.nodes.size > 1 || citations.length > 0,
    latencyMs: Math.round(performance.now() - started),
  }
}

// ---------- person card ----------

export function buildPersonCard(g: KnowledgeGraph, id: string): PersonCard | null {
  const started = performance.now()
  const self = g.getNode(id)
  if (!self || self.kind !== 'person') return null
  const { nodes, edges } = g.getGraphSnapshot()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const mine = new Map<string, { node: GraphNode; role: string }>()
  const claim = (n: GraphNode, role: string) => {
    if (!mine.has(n.id)) mine.set(n.id, { node: n, role })
  }
  for (const e of edges) {
    if (e.relation !== 'assigned_to' || e.to !== self.id) continue
    const n = byId.get(e.from)
    if (!n) continue
    if (n.kind === 'action') claim(n, 'Prowadzi')
    else if (n.kind === 'decision') claim(n, n.attributes.approver && fold(n.attributes.approver) === fold(self.label) ? 'Zatwierdza' : 'Decyduje')
  }
  for (const n of nodes) {
    if (n.kind !== 'decision' && n.kind !== 'action') continue
    if (n.attributes.owner && fold(n.attributes.owner) === fold(self.label)) claim(n, 'Właściciel')
    if (n.attributes.approver && fold(n.attributes.approver) === fold(self.label)) claim(n, 'Zatwierdza')
    if (n.attributes.requested_by && fold(n.attributes.requested_by) === fold(self.label)) claim(n, 'Wnioskował')
  }
  const items = [...mine.values()]
  const owns = items.map(({ node, role }) => `${role}: ${node.label}${node.attributes.status ? ` (${plStatus(node.attributes.status)})` : ''}`)
  const topics = new Map<string, string>()
  for (const { node } of items) for (const e of edges) if (e.from === node.id && e.relation === 'about') topics.set(e.to, byId.get(e.to)?.label ?? e.to)
  const hood: Hood = { self, nodes: new Map(items.map(({ node }) => [node.id, node])), edges: [], byId }
  const recent = eventsOf(hood).reverse().slice(0, 8)
  const mentions = g.searchChunks(self.label, 20)
  const citations: GraphCitation[] = []
  const seen = new Set<string>()
  for (const e of g.getNodeEvidence(self.id)) if (!seen.has(e.chunk.id) && citations.length < 6) (seen.add(e.chunk.id), citations.push({ id: '', quote: e.quote, path: e.chunk.path, date: e.chunk.authoredAt, kind: e.chunk.kind }))
  for (const hit of mentions) if (!seen.has(hit.chunk.id) && citations.length < 6) (seen.add(hit.chunk.id), citations.push({ id: '', quote: hit.chunk.text.length > 500 ? `${hit.chunk.text.slice(0, 500)}…` : hit.chunk.text, path: hit.chunk.path, date: hit.chunk.authoredAt, kind: hit.chunk.kind }))
  const facts: CardFact[] = []
  if (self.attributes.role) facts.push({ label: 'Rola', value: self.attributes.role, facets: ['general', 'owner'] })
  if (self.attributes.email) facts.push({ label: 'E-mail', value: self.attributes.email, facets: ['general'] })
  const openActions = items.filter(({ node }) => node.kind === 'action' && node.attributes.status === 'open').length
  facts.push({ label: 'Decyzje', value: String(items.filter(({ node }) => node.kind === 'decision').length), facets: ['history', 'general'] })
  if (openActions) facts.push({ label: 'Otwarte zadania', value: String(openActions), facets: ['status', 'deadline'] })
  facts.push({ label: 'Wzmianki w źródłach', value: String(mentions.length), facets: ['general'] })
  return {
    kind: 'person',
    id: self.id,
    name: self.label,
    role: self.attributes.role,
    email: self.attributes.email,
    facts,
    owns,
    topics: [...topics.entries()].map(([tid, label]) => ({ id: tid, label })),
    recent,
    citations: citations.map((c, i) => ({ ...c, id: `E${i + 1}` })),
    latencyMs: Math.round(performance.now() - started),
  }
}

export function buildCard(input: { kind: 'topic' | 'person'; id: string; facet?: Facet }, g: KnowledgeGraph = openGraph()): GraphCard | null {
  return input.kind === 'person' ? buildPersonCard(g, input.id) : buildTopicCard(g, input.id, input.facet ?? 'general')
}
