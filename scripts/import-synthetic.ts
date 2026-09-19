import { KnowledgeGraph } from '../src/graph/index.ts';
import { importSyntheticCorpus, SYNTHETIC_FIXTURE_VERSION } from '../src/corpus/import-synthetic.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const asOf = option('--as-of') ?? '2025-11-19';
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('--as-of requires YYYY-MM-DD');
const databasePath = option('--db') ?? `knowledge/synthetic/local-demo-v${SYNTHETIC_FIXTURE_VERSION}-${asOf}.sqlite`;
const graph = new KnowledgeGraph(databasePath);
try {
  const summary = await importSyntheticCorpus(graph, asOf);
  const context = graph.buildDecisionContext('Should we build or partner for the e-Doręczenia integration?');
  console.log(JSON.stringify({ databasePath, asOf, ...summary,
    citedEvidence: context.evidence.length,
    sampleSources: context.evidence.slice(0, 5).map((item) => item.chunk.path) }, null, 2));
} finally {
  graph.close();
}
