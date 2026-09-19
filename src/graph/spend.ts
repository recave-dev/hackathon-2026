import type { KnowledgeGraph } from './store.ts';
import type { GraphNode } from './types.ts';

export interface SpendObservation {
  id: string;
  label: string;
  observedAt: string;
  value: number;
  currency: string;
  attributes: Record<string, string>;
  sourcePath: string | null;
  quote: string | null;
}

export interface SpendDecision {
  id: string;
  label: string;
  status: string;
  decidedAt: string | null;
  approvers: string[];
  owner: string | null;
  requestedBy: string | null;
}

export interface SpendSummary {
  metricId: string;
  metricLabel: string;
  from: string;
  to: string;
  currency: string | null;
  total: number;
  observations: SpendObservation[];
  decisions: SpendDecision[];
  /** People named by assigned_to edges on decisions targeting the metric. */
  approvers: GraphNode[];
  /** People named by assigned_to edges on actions about the same entity as those decisions. */
  owners: GraphNode[];
}

function within(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

/**
 * Sum observation nodes that `measures` a metric inside an inclusive date window and
 * collect the decisions and people that explain the spend. Dates are YYYY-MM-DD.
 */
export function summarizeSpend(graph: KnowledgeGraph, metricId: string, window: { from: string; to: string }): SpendSummary {
  const metric = graph.getNode(metricId);
  if (!metric || metric.kind !== 'metric') throw new Error(`Metric not found: ${metricId}`);
  const { nodes, edges } = graph.getGraphSnapshot();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const observations: SpendObservation[] = [];
  for (const edge of edges) {
    if (edge.relation !== 'measures' || edge.to !== metricId) continue;
    const node = byId.get(edge.from);
    if (!node || node.kind !== 'observation') continue;
    const observedAt = node.attributes.observed_at ?? '';
    const value = Number(node.attributes.value);
    if (!within(observedAt, window.from, window.to) || !Number.isFinite(value)) continue;
    const evidence = graph.getNodeEvidence(node.id)[0];
    observations.push({
      id: node.id, label: node.label, observedAt, value,
      currency: node.attributes.currency ?? metric.attributes.unit ?? '',
      attributes: node.attributes,
      sourcePath: evidence?.chunk.path ?? null,
      quote: evidence?.quote ?? null,
    });
  }
  observations.sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  const decisions: SpendDecision[] = [];
  const approverIds = new Set<string>();
  const aboutIds = new Set<string>();
  for (const edge of edges) {
    if (edge.relation !== 'targets' || edge.to !== metricId) continue;
    const decision = byId.get(edge.from);
    if (!decision || decision.kind !== 'decision') continue;
    const approvers: string[] = [];
    for (const link of edges) {
      if (link.from !== decision.id) continue;
      if (link.relation === 'assigned_to') { approverIds.add(link.to); approvers.push(byId.get(link.to)?.label ?? link.to); }
      if (link.relation === 'about') aboutIds.add(link.to);
    }
    decisions.push({
      id: decision.id, label: decision.label, status: decision.attributes.status ?? 'unknown',
      decidedAt: decision.attributes.decided_at ?? null, approvers,
      owner: decision.attributes.owner ?? null, requestedBy: decision.attributes.requested_by ?? null,
    });
  }
  decisions.sort((a, b) => (a.decidedAt ?? '').localeCompare(b.decidedAt ?? ''));

  const ownerIds = new Set<string>();
  for (const edge of edges) {
    if (edge.relation !== 'about' || !aboutIds.has(edge.to)) continue;
    const action = byId.get(edge.from);
    if (!action || action.kind !== 'action') continue;
    for (const link of edges) {
      if (link.from === action.id && link.relation === 'assigned_to') ownerIds.add(link.to);
    }
  }

  const people = (ids: Set<string>) => [...ids].map((id) => byId.get(id)).filter((node): node is GraphNode => !!node && node.kind === 'person');
  const currencies = new Set(observations.map((item) => item.currency).filter(Boolean));
  return {
    metricId, metricLabel: metric.label, from: window.from, to: window.to,
    currency: currencies.size === 1 ? [...currencies][0]! : null,
    total: Math.round(observations.reduce((sum, item) => sum + item.value, 0) * 100) / 100,
    observations, decisions, approvers: people(approverIds), owners: people(ownerIds),
  };
}
