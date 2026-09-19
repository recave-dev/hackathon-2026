import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FOLLOW_UP_DECISION } from '../corpus/import-synthetic.ts';
import type { KnowledgeGraph } from '../graph/store.ts';
import type { GraphExtractor, GraphPatch, IngestionProposal, SourceDocument } from '../graph/types.ts';

/**
 * A "coworker" agent: a scheduled automation that reads support tickets already in the
 * company graph, looks for a repeating problem, and files a product proposal for review.
 * It never writes graph facts directly; its report is ingested like any other source and
 * lands as a pending proposal the CEO can accept or reject.
 */
export const AGENT_ID = 'support-pattern-watcher';

export interface WatcherOptions {
  /** Inclusive YYYY-MM-DD date of the run. Tickets after this date are invisible. */
  asOf: string;
  /** Sliding window in days that a pattern has to fill. */
  windowDays?: number;
  /** Minimum tickets inside the window. */
  minTickets?: number;
  /** Minimum distinct customers inside the window. */
  minCustomers?: number;
  /** Open decision the proposal should inform. */
  decisionId?: string;
  /** Apply the proposal immediately instead of leaving it pending. */
  apply?: boolean;
  /** Write the report Markdown to this path in addition to ingesting it. */
  saveTo?: string;
}

export interface TicketRecord {
  ticket: string;
  documentId: string;
  chunkId: string;
  path: string;
  date: string;
  customer: string;
  category: string;
  title: string;
  quote: string;
  /** The customer proposed a concrete fix in the ticket text. */
  suggestsFix: boolean;
}

export interface PatternCluster {
  category: string;
  tickets: TicketRecord[];
  inWindow: TicketRecord[];
  customers: string[];
  fired: boolean;
  reason: string;
}

export interface WatcherRun {
  agent: typeof AGENT_ID;
  asOf: string;
  windowStart: string;
  thresholds: { windowDays: number; minTickets: number; minCustomers: number };
  ticketsScanned: number;
  clusters: PatternCluster[];
  fired: PatternCluster | null;
  report: SourceDocument | null;
  proposals: IngestionProposal[];
}

const META = /^Customer: (.+?) · Category: (\S+) · Channel: .+? · Opened: (\d{4}-\d{2}-\d{2})$/m;
const HEADING = /^# (HD-\d{4}) · (.+)$/m;

function shiftDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function firstSentence(text: string): string {
  const body = text.split('\n').map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('Customer:') && !line.startsWith('Resolution:'));
  const paragraph = body.join(' ');
  const sentences = paragraph.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [paragraph];
  let quote = '';
  for (const sentence of sentences) {
    quote = `${quote} ${sentence.trim()}`.trim();
    if (quote.length >= 80) break;
  }
  return quote;
}

function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Read every support ticket chunk visible at `asOf` and group them by category. */
export function scanTickets(graph: KnowledgeGraph, options: WatcherOptions): Omit<WatcherRun, 'report' | 'proposals'> {
  const windowDays = options.windowDays ?? 60;
  const minTickets = options.minTickets ?? 4;
  const minCustomers = options.minCustomers ?? 3;
  const windowStart = shiftDays(options.asOf, -windowDays);
  const tickets: TicketRecord[] = [];
  for (const chunk of graph.listChunks({ kind: 'support_ticket', until: options.asOf })) {
    const meta = chunk.text.match(META);
    const heading = chunk.text.match(HEADING);
    if (!meta || !heading) continue;
    tickets.push({ ticket: heading[1]!, documentId: chunk.documentId, chunkId: chunk.id, path: chunk.path,
      date: meta[3]!, customer: meta[1]!, category: meta[2]!, title: heading[2]!, quote: firstSentence(chunk.text),
      suggestsFix: /Customer suggestion recorded|match on the case reference|propose the case|proposes? and confirm/i.test(chunk.text) });
  }
  const byCategory = new Map<string, TicketRecord[]>();
  for (const ticket of tickets) byCategory.set(ticket.category, [...(byCategory.get(ticket.category) ?? []), ticket]);
  const clusters: PatternCluster[] = [...byCategory.entries()].map(([category, all]) => {
    const inWindow = all.filter((ticket) => ticket.date >= windowStart);
    const customers = [...new Set(inWindow.map((ticket) => ticket.customer))].sort();
    const fired = inWindow.length >= minTickets && customers.length >= minCustomers;
    const reason = fired
      ? `${inWindow.length} tickets from ${customers.length} customers since ${windowStart}`
      : `${inWindow.length} tickets from ${customers.length} customers since ${windowStart}; needs ${minTickets} tickets from ${minCustomers} customers`;
    return { category, tickets: all, inWindow, customers, fired, reason };
  }).sort((a, b) => b.inWindow.length - a.inWindow.length || a.category.localeCompare(b.category));
  return {
    agent: AGENT_ID, asOf: options.asOf, windowStart, thresholds: { windowDays, minTickets, minCustomers },
    ticketsScanned: tickets.length, clusters, fired: clusters.find((cluster) => cluster.fired) ?? null,
  };
}

const optionLabel = 'Build automatic case matching for incoming e-Doręczenia messages';

/** Deterministic report text. Quotes inside it are what the graph proposal will cite. */
export function buildReport(graph: KnowledgeGraph, run: Omit<WatcherRun, 'report' | 'proposals'>, cluster: PatternCluster, decisionId: string): SourceDocument {
  const decision = graph.getNode(decisionId);
  if (!decision) throw new Error(`Decision not found: ${decisionId}`);
  const product = graph.getNode('product:edoreczenia');
  const first = [...cluster.tickets].sort((a, b) => a.date.localeCompare(b.date))[0]!;
  const summary = `Category ${cluster.category} has ${cluster.inWindow.length} tickets from ${cluster.customers.length} customers in the ${run.thresholds.windowDays} days to ${longDate(run.asOf)}, and ${cluster.tickets.length} tickets in total since ${longDate(first.date)}.`;
  const evidence = cluster.inWindow.map((ticket) =>
    `- ${ticket.ticket} (${ticket.customer}, ${ticket.date}): "${ticket.quote}"`).join('\n');
  const suggestions = cluster.tickets.filter((ticket) => ticket.suggestsFix);
  const content = `---
id: agent-${AGENT_ID}-${run.asOf}
kind: agent_report
date: ${run.asOf}
topic: support pattern watcher run
agent: ${AGENT_ID}
---

## Pattern detected

${summary} Threshold: at least ${run.thresholds.minTickets} tickets from at least ${run.thresholds.minCustomers} customers. Every ticket concerns the ${product?.label ?? 'e-Doręczenia integration'} delivered through the partner connector. This is relevant to the open decision "${decision.label}".

Tickets in the window:

${evidence}

## Proposed option

${optionLabel}: extend the ${product?.label ?? 'e-Doręczenia integration'} so it reads the case reference number printed in every official message, proposes the matching open case, and lets the clerk confirm before attachment. Customers described this themselves in ${suggestions.map((ticket) => ticket.ticket).join(', ') || 'the tickets above'}. For decision: ${decision.label}.

Suggested next step: Product sizes the change and asks ConnectorCo whether reference-number matching is on their roadmap before the ${decision.attributes.review_at ? longDate(decision.attributes.review_at) : 'next'} review. This is an agent proposal and needs human review before it counts as a decision input.
`;
  return {
    id: `agent-${AGENT_ID}-${run.asOf}`,
    path: `knowledge/synthetic/agents/${AGENT_ID}-${run.asOf}.md`,
    kind: 'agent_report',
    content,
    authoredAt: run.asOf,
  };
}

function reportExtractor(cluster: PatternCluster, decisionId: string, asOf: string): GraphExtractor {
  return {
    async extract({ chunk }): Promise<GraphPatch> {
      const empty: GraphPatch = { newNodes: [], edges: [], nodeEvidence: [], aliasUpdates: [] };
      if (chunk.heading.endsWith('Pattern detected')) {
        const summary = chunk.text.split('\n').find((line) => line.startsWith('Category '))!.split(' Threshold:')[0]!;
        const quotes = cluster.inWindow.map((ticket) => chunk.text.match(new RegExp(`^- ${ticket.ticket} .*$`, 'm'))?.[0]).filter((q): q is string => !!q);
        return {
          newNodes: [{ tempId: 'pattern', kind: 'claim',
            label: `Support tickets show a repeating ${cluster.category.replaceAll('_', ' ')} problem across ${cluster.customers.length} customers`,
            aliases: [],
            attributes: [
              { key: 'claim_kind', value: 'ticket_pattern' }, { key: 'agent', value: AGENT_ID }, { key: 'detected_at', value: asOf },
              { key: 'category', value: cluster.category }, { key: 'tickets_in_window', value: String(cluster.inWindow.length) },
              { key: 'tickets_total', value: String(cluster.tickets.length) }, { key: 'customers', value: cluster.customers.join('; ') },
              { key: 'ticket_ids', value: cluster.tickets.map((ticket) => ticket.ticket).join(', ') },
              { key: 'evidence_status', value: 'agent_detected' },
            ] }],
          edges: [
            { from: 'pattern', relation: 'informs', to: decisionId, quote: summary, basis: 'inferred' },
            { from: 'pattern', relation: 'about', to: 'product:edoreczenia', quote: summary, basis: 'explicit' },
          ],
          nodeEvidence: [{ nodeRef: 'pattern', quote: summary, role: 'supports' },
            ...quotes.map((quote) => ({ nodeRef: 'pattern', quote, role: 'supports' as const }))],
          aliasUpdates: [],
        };
      }
      if (chunk.heading.endsWith('Proposed option')) {
        const quote = chunk.text.split('\n').find((line) => line.startsWith(optionLabel))!;
        return {
          newNodes: [{ tempId: 'opt', kind: 'option', label: optionLabel, aliases: ['automatic case matching'],
            attributes: [{ key: 'proposed_by', value: AGENT_ID }, { key: 'proposed_at', value: asOf }, { key: 'status', value: 'proposed' }] }],
          edges: [
            { from: decisionId, relation: 'considers', to: 'opt', quote, basis: 'inferred' },
            { from: 'opt', relation: 'about', to: 'product:edoreczenia', quote, basis: 'explicit' },
          ],
          nodeEvidence: [{ nodeRef: 'opt', quote, role: 'supports' }],
          aliasUpdates: [],
        };
      }
      return empty;
    },
  };
}

/** One scheduled run: scan, and if a pattern fires, file the report as a graph proposal. */
export async function runSupportPatternWatcher(graph: KnowledgeGraph, options: WatcherOptions): Promise<WatcherRun> {
  const scan = scanTickets(graph, options);
  const decisionId = options.decisionId ?? FOLLOW_UP_DECISION;
  if (!scan.fired) return { ...scan, report: null, proposals: [] };
  const report = buildReport(graph, scan, scan.fired, decisionId);
  if (options.saveTo) {
    await mkdir(dirname(options.saveTo), { recursive: true });
    await writeFile(options.saveTo, report.content, 'utf8');
  }
  const proposals = await graph.ingestDocument(report, reportExtractor(scan.fired, decisionId, options.asOf), options.apply ?? false);
  return { ...scan, report, proposals };
}
