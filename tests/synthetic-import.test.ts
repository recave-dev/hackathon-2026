import assert from 'node:assert/strict';
import test from 'node:test';
import { importSyntheticCorpus } from '../src/corpus/import-synthetic.ts';
import { KnowledgeGraph } from '../src/graph/store.ts';

const question = 'Should we build or partner for the e-Doręczenia integration?';

test('May snapshot imports sourced decision evidence without the future outcome', async () => {
  const graph = new KnowledgeGraph();
  try {
    const summary = await importSyntheticCorpus(graph, '2025-05-12');
    assert.equal(summary.documents, 21);
    assert.equal(summary.evidenceNodes, 14);
    const context = graph.buildDecisionContext(question);
    const paths = context.evidence.map((item) => item.chunk.path);
    assert(paths.some((path) => path.includes('slack/2025-05-02-sales-demand.md')));
    assert.equal(paths.filter((path) => path.includes('/emails/') && path.includes('-request.md')).length, 4);
    assert(paths.some((path) => path.includes('notes/previous-decision.md')));
    assert(!paths.some((path) => path.includes('2025-11-12-outcome-review.md')));
    assert.equal(graph.getNode('decision:edoreczenia-build-or-partner')?.attributes.status, 'approved');
  } finally {
    graph.close();
  }
});

test('November snapshot connects the measured outcome and repeat import is idempotent', async () => {
  const graph = new KnowledgeGraph();
  try {
    const first = await importSyntheticCorpus(graph, '2025-11-19');
    assert.equal(first.documents, 66);
    const context = graph.buildDecisionContext(question);
    assert(context.evidence.some((item) => item.chunk.path.includes('2025-11-12-outcome-review.md')));
    assert(context.nodes.some((node) => node.kind === 'observation' && node.attributes.value === '6'));
    const second = await importSyntheticCorpus(graph, '2025-11-19');
    assert.equal(second.chunks, 0);
    assert.equal(second.graphNodes, first.graphNodes);
    assert.equal(second.graphEdges, first.graphEdges);
  } finally {
    graph.close();
  }
});
