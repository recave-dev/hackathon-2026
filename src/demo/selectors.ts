import { parseLocal, toLocalIso } from './format'
import type { ContextCategory, ContextSpend, Decision, DecisionStatus, DemoState, Id, Invoice } from './types'

export type DecisionFilter = 'pending' | 'snoozed' | 'history'

const HISTORY: DecisionStatus[] = ['decided', 'delegated', 'completed']

export const byDue = (a: Decision, b: Decision): number =>
  parseLocal(a.dueAt).getTime() - parseLocal(b.dueAt).getTime()

const byDecidedDesc = (a: Decision, b: Decision): number =>
  parseLocal(b.decidedAt ?? b.createdAt).getTime() - parseLocal(a.decidedAt ?? a.createdAt).getTime()

export function decisionsFor(state: DemoState, filter: DecisionFilter): Decision[] {
  switch (filter) {
    case 'pending':
      return state.decisions.filter((d) => d.status === 'pending').sort(byDue)
    case 'snoozed':
      return state.decisions
        .filter((d) => d.status === 'snoozed')
        .sort((a, b) => parseLocal(a.snoozedUntil ?? a.dueAt).getTime() - parseLocal(b.snoozedUntil ?? b.dueAt).getTime())
    case 'history':
      return state.decisions.filter((d) => HISTORY.includes(d.status)).sort(byDecidedDesc)
  }
}

export const pendingDecisions = (state: DemoState): Decision[] => decisionsFor(state, 'pending')

export const personName = (state: DemoState, id: Id | undefined): string =>
  state.people.find((p) => p.id === id)?.name ?? '—'

export const projectLabel = (state: DemoState, id: Id): string => {
  const project = state.projects.find((p) => p.id === id)
  if (!project) return '—'
  return project.client ? `${project.client} · ${project.name}` : project.name
}

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  pending: 'Do decyzji',
  snoozed: 'Odłożona',
  decided: 'Zdecydowano',
  delegated: 'Delegowano',
  completed: 'Zakończona',
}

/** Decisions whose execution still has open steps (waiting for someone else). */
export const inProgressDecisions = (state: DemoState): Decision[] =>
  state.decisions.filter((d) => d.execution.some((s) => s.status === 'waiting'))

export const openTasks = (state: DemoState) => state.tasks.filter((t) => t.status === 'open')

export const CONTEXT_CATEGORY_LABEL: Record<ContextCategory, string> = {
  tool: 'Narzędzie',
  vendor: 'Dostawca',
  project: 'Projekt',
}

/** Inclusive window ending at `now`, starting `months` calendar months earlier. */
export function spendWindow(now: string, months = 6): { from: string; to: string } {
  const to = parseLocal(now)
  const from = new Date(to)
  from.setMonth(from.getMonth() - months)
  return { from: toLocalIso(from).slice(0, 10), to: now.slice(0, 10) }
}

export function invoicesInWindow(spend: ContextSpend, window: { from: string; to: string }): Invoice[] {
  return spend.invoices
    .filter((inv) => inv.date >= window.from && inv.date <= window.to)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const sumInvoices = (invoices: Invoice[]): number =>
  Math.round(invoices.reduce((sum, inv) => sum + inv.amount, 0) * 100) / 100
