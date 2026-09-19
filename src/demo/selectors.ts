import { parseLocal } from './format'
import type { Decision, DecisionStatus, DemoState, Id } from './types'

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
