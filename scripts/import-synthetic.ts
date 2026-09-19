import { KnowledgeGraph, summarizeSpend } from '../src/graph/index.ts';
import { importSyntheticCorpus, SYNTHETIC_FIXTURE_VERSION } from '../src/corpus/import-synthetic.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function shiftMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1 + months, day!));
  return shifted.toISOString().slice(0, 10);
}

const asOf = option('--as-of') ?? '2025-11-19';
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('--as-of requires YYYY-MM-DD');
const databasePath = option('--db') ?? `knowledge/synthetic/local-demo-v${SYNTHETIC_FIXTURE_VERSION}-${asOf}.sqlite`;
const graph = new KnowledgeGraph(databasePath);
try {
  const summary = await importSyntheticCorpus(graph, asOf);
  const context = graph.buildDecisionContext('Should we build or partner for the e-Doręczenia integration?');
  const spend = graph.getNode('metric:pipedrive-subscription-spend')
    ? summarizeSpend(graph, 'metric:pipedrive-subscription-spend', { from: shiftMonths(asOf, -6), to: asOf })
    : null;
  console.log(JSON.stringify({ databasePath, asOf, ...summary,
    citedEvidence: context.evidence.length,
    sampleSources: context.evidence.slice(0, 5).map((item) => item.chunk.path),
    pipedriveLastSixMonths: spend && { total: spend.total, currency: spend.currency, invoices: spend.observations.length,
      approvers: spend.approvers.map((person) => person.label), owners: spend.owners.map((person) => person.label) } }, null, 2));
} finally {
  graph.close();
}
