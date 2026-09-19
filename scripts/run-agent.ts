import { KnowledgeGraph } from '../src/graph/index.ts';
import { importSyntheticCorpus } from '../src/corpus/import-synthetic.ts';
import { AGENT_ID, runSupportPatternWatcher } from '../src/agents/support-pattern-watcher.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const asOf = option('--as-of') ?? '2025-11-17';
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('--as-of requires YYYY-MM-DD');
const databasePath = option('--db');
const apply = process.argv.includes('--apply');
const save = !process.argv.includes('--no-save');

const graph = new KnowledgeGraph(databasePath ?? ':memory:');
try {
  if (!databasePath) await importSyntheticCorpus(graph, asOf);
  const run = await runSupportPatternWatcher(graph, {
    asOf, apply, saveTo: save ? `knowledge/synthetic/agents/${AGENT_ID}-${asOf}.md` : undefined,
  });
  console.log(JSON.stringify({
    agent: run.agent, asOf, database: databasePath ?? ':memory:', ticketsScanned: run.ticketsScanned,
    thresholds: run.thresholds,
    clusters: run.clusters.map((cluster) => ({ category: cluster.category, inWindow: cluster.inWindow.length,
      total: cluster.tickets.length, customers: cluster.customers, fired: cluster.fired, reason: cluster.reason })),
    fired: run.fired?.category ?? null,
    report: run.report?.path ?? null,
    proposals: run.proposals.map((proposal) => ({ id: proposal.id, status: proposal.status,
      nodes: proposal.diff.nodes.map((node) => `${node.after.kind}: ${node.after.label}`),
      edges: proposal.diff.edges.map((edge) => `${edge.from} --${edge.relation}--> ${edge.to}`) })),
  }, null, 2));
} finally {
  graph.close();
}
