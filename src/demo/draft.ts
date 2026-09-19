import { addDays } from './format'
import type { BundleEvidence, BundleNode, DraftBundle } from '@/server/decision-draft'
import type { Consequences, Id, Source, SourceKind } from './types'

/** A pickable line in the draft; the user can leave items out before creating the decision. */
export interface DraftItem {
  id: string
  text: string
  included: boolean
  /** Where the line came from, shown as a small tag. */
  origin: string
}

export interface DraftOption {
  id: string
  label: string
  description: string
  consequences: Consequences
  included: boolean
}

export interface DraftSource extends Source {
  included: boolean
  path: string
  line: number
  direct: boolean
  role: BundleEvidence['role']
}

export interface DecisionDraft {
  title: string
  why: string
  projectId: Id
  dueAt: string
  context: DraftItem[]
  facts: DraftItem[]
  unknowns: DraftItem[]
  assumptions: DraftItem[]
  options: DraftOption[]
  sources: DraftSource[]
  agentPlan: string
}

const SOURCE_KIND: Record<BundleEvidence['kind'], SourceKind> = {
  slack: 'slack',
  email: 'email',
  meeting_note: 'meeting',
  note: 'document',
  external: 'document',
  kpi: 'kpi',
  decision_record: 'document',
  support_ticket: 'document',
  agent_report: 'document',
}

const KIND_LABEL: Record<BundleEvidence['kind'], string> = {
  slack: 'Slack',
  email: 'Email',
  meeting_note: 'Notatka ze spotkania',
  note: 'Notatka',
  external: 'Źródło zewnętrzne',
  kpi: 'KPI',
  decision_record: 'Zapis decyzji',
  support_ticket: 'Zgłoszenie',
  agent_report: 'Raport agenta',
}

const STATUS_PL: Record<string, string> = {
  approved: 'zatwierdzona',
  rejected: 'odrzucona',
  open: 'otwarta',
  pending: 'w toku',
  done: 'wykonane',
}

const humanDate = (iso: string | undefined | null): string => (iso ? iso.slice(0, 10) : '')

const basename = (path: string): string => path.split('/').pop() ?? path

const attr = (n: BundleNode, ...keys: string[]): string | undefined => {
  for (const k of keys) if (n.attributes[k]) return n.attributes[k]
  return undefined
}

/** Claims whose status says the source only reports, estimates or assumes. */
const isSoft = (n: BundleNode): boolean => {
  const status = (attr(n, 'evidence_status') ?? '').toLowerCase()
  const kind = (attr(n, 'claim_kind') ?? '').toLowerCase()
  return (
    n.disputed ||
    /unverified|conditional|reported|assum|estimate|forecast/.test(status) ||
    /interest|assum|forecast/.test(kind)
  )
}

const isEstimate = (n: BundleNode): boolean => /estimate|assum|forecast/.test((attr(n, 'claim_kind') ?? '').toLowerCase())

const item = (id: string, text: string, origin: string, included = true): DraftItem => ({ id, text, origin, included })

const withValue = (n: BundleNode): string => {
  const parts: string[] = [n.label]
  const value = attr(n, 'value', 'monthly_cost_eur', 'duration_weeks')
  const unit = attr(n, 'unit')
  if (value && !n.label.includes(value)) parts.push(`(${value}${unit ? ` ${unit}` : ''})`)
  const date = humanDate(attr(n, 'decided_at', 'date', 'due_at', 'observed_at'))
  if (date) parts.push(`· ${date}`)
  return parts.join(' ')
}

/** Guess the demo project a question belongs to; the user can change it. */
export function guessProjectId(bundle: DraftBundle): Id {
  const text = [bundle.question, ...bundle.anchors.map((a) => a.label), ...bundle.products.map((p) => p.label)].join(' ').toLowerCase()
  if (/dor[eę]czeni|connector|konektor|civicflow/.test(text)) return 'prj-edoreczenia'
  if (/pipedrive|intercom|seat|subskrypc|licen|tool/.test(text)) return 'prj-infra'
  if (/alfa/.test(text)) return 'prj-alfa'
  if (/gamma/.test(text)) return 'prj-gamma'
  return 'prj-platform'
}

export function buildDraft(bundle: DraftBundle, now: string): DecisionDraft {
  const question = bundle.question.trim()
  const title = /[?.!]$/.test(question) ? question : `${question}?`

  const context: DraftItem[] = [
    ...bundle.priorDecisions.map((d) => {
      const status = STATUS_PL[attr(d, 'status') ?? ''] ?? attr(d, 'status') ?? ''
      const when = humanDate(attr(d, 'decided_at', 'opened_at', 'review_at'))
      const owner = attr(d, 'owner', 'approver')
      const tail = [status, when, owner ? `odpowiada ${owner}` : ''].filter(Boolean).join(', ')
      return item(`ctx-${d.id}`, `Wcześniejsza decyzja: ${d.label}${tail ? ` (${tail})` : ''}.`, 'graf · decyzja')
    }),
    ...(bundle.people.length
      ? [
          item(
            'ctx-people',
            `Osoby w sprawie: ${bundle.people.map((p) => `${p.label}${attr(p, 'role') ? ` (${attr(p, 'role')})` : ''}`).join(', ')}.`,
            'graf · osoby',
          ),
        ]
      : []),
    ...(bundle.organizations.length
      ? [
          item(
            'ctx-orgs',
            `Organizacje: ${bundle.organizations.map((o) => `${o.label}${attr(o, 'role') ? ` (${attr(o, 'role')})` : ''}`).join(', ')}.`,
            'graf · organizacje',
          ),
        ]
      : []),
  ]

  const facts: DraftItem[] = [
    ...bundle.observations.map((o) => item(`fact-${o.id}`, `${withValue(o)}.`, 'obserwacja')),
    ...bundle.claims.filter((c) => !isSoft(c)).map((c) => item(`fact-${c.id}`, `${withValue(c)}.`, 'twierdzenie ze źródła')),
  ]

  const unknowns: DraftItem[] = [
    ...bundle.claims
      .filter((c) => isSoft(c) && !isEstimate(c))
      .map((c) => item(`unk-${c.id}`, `${withValue(c)} — ${c.disputed ? 'sporne' : 'niepotwierdzone'}.`, 'twierdzenie ze źródła')),
    ...bundle.actions.map((a) => {
      const owner = attr(a, 'owner', 'assigned_to')
      const due = humanDate(attr(a, 'due_at', 'due'))
      return item(`unk-${a.id}`, `Otwarte działanie: ${a.label}${owner ? ` (${owner}${due ? `, do ${due}` : ''})` : ''}.`, 'działanie')
    }),
    ...bundle.metrics
      .filter((m) => !bundle.observations.some((o) => o.label.toLowerCase().includes(m.label.toLowerCase().split(' ')[0] ?? '')))
      .map((m) => item(`unk-${m.id}`, `Brak świeżego pomiaru dla metryki „${m.label}”.`, 'metryka')),
  ]

  const assumptions: DraftItem[] = bundle.claims
    .filter(isEstimate)
    .map((c) => item(`asm-${c.id}`, `${withValue(c)} — szacunek, nie fakt.`, 'szacunek'))

  const graphOptions: DraftOption[] = bundle.options.map((o) => ({
    id: `opt-${o.id}`,
    label: o.label,
    description: o.decisionLabel ? `Opcja rozważana wcześniej w sprawie „${o.decisionLabel}”.` : 'Opcja z grafu firmy.',
    consequences: {},
    included: true,
  }))
  const options: DraftOption[] = graphOptions.length
    ? graphOptions
    : [
        { id: 'opt-yes', label: 'Tak — zatwierdź', description: 'Zrób to, co opisuje pytanie.', consequences: {}, included: true },
        { id: 'opt-no', label: 'Nie — odrzuć', description: 'Zostaw stan obecny i zapisz powód.', consequences: {}, included: true },
        { id: 'opt-later', label: 'Odłóż i dopytaj', description: 'Zbierz brakujące dane i wróć do sprawy.', consequences: {}, included: true },
      ]

  const seen = new Set<string>()
  const sources: DraftSource[] = bundle.evidence
    .filter((e) => {
      const key = `${e.chunkId}|${e.quote}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((e, index) => ({
      id: `src-graph-${e.chunkId.replace(/^chunk:/, '')}-${e.line}-${index}`,
      kind: SOURCE_KIND[e.kind],
      title: `${KIND_LABEL[e.kind]} · ${e.heading || basename(e.path)}`,
      excerpt: e.quote,
      date: humanDate(e.date) || now.slice(0, 10),
      path: e.path,
      line: e.line,
      direct: e.direct,
      role: e.role,
      included: true,
    }))

  const why = [
    `Sprawa założona ręcznie. Agent przeszukał ${bundle.stats.documents} dokumentów w grafie firmy`,
    `i znalazł ${sources.length} cytatów, ${bundle.claims.length} twierdzeń oraz ${bundle.priorDecisions.length} powiązanych decyzji.`,
    'Uzupełnij, dlaczego trzeba to rozstrzygnąć teraz.',
  ].join(' ')

  return {
    title,
    why,
    projectId: guessProjectId(bundle),
    dueAt: addDays(now, 3).slice(0, 10) + 'T17:00:00',
    context,
    facts,
    unknowns,
    assumptions,
    options,
    sources,
    agentPlan:
      'Po zatwierdzeniu agent utworzy zadania dla osób wskazanych w wybranej opcji, poinformuje uczestników sprawy i zapisze decyzję w grafie z odnośnikami do źródeł. Nic nie zostanie wysłane bez Twojej akceptacji.',
  }
}
