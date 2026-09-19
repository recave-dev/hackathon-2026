import assert from 'node:assert/strict';
import test from 'node:test';
import { importSyntheticCorpus } from '../src/corpus/import-synthetic.ts';
import { KnowledgeGraph } from '../src/graph/store.ts';
import { summarizeSpend } from '../src/graph/spend.ts';

const metric = 'metric:pipedrive-subscription-spend';
const question = 'How much did Pipedrive cost us in the last 6 months and who is responsible for that?';

test('Pipedrive spend over the last six months sums six invoices and names approver and owner', async () => {
  const graph = new KnowledgeGraph();
  try {
    await importSyntheticCorpus(graph, '2025-11-19');
    const spend = summarizeSpend(graph, metric, { from: '2025-05-19', to: '2025-11-19' });
    assert.equal(spend.total, 1224);
    assert.equal(spend.currency, 'EUR');
    assert.deepEqual(spend.observations.map((item) => item.value), [170, 170, 170, 170, 272, 272]);
    assert(spend.observations.every((item) => item.sourcePath?.includes('/emails/') && item.sourcePath.includes('pipedrive-invoice')));
    assert.deepEqual(spend.approvers.map((person) => person.label), ['Karol Bąk']);
    assert.deepEqual(spend.owners.map((person) => person.label), ['Tomasz Nowak']);
    assert.deepEqual(spend.decisions.map((item) => [item.status, item.decidedAt]),
      [['approved', '2025-05-15'], ['approved', '2025-09-03']]);
  } finally {
    graph.close();
  }
});

test('Finance decisions include rejections and are linked to Karol Bąk', async () => {
  const graph = new KnowledgeGraph();
  try {
    await importSyntheticCorpus(graph, '2025-11-19');
    const { nodes, edges } = graph.getGraphSnapshot();
    const karolDecisions = edges
      .filter((edge) => edge.relation === 'assigned_to' && edge.to === 'person:karol-bak')
      .map((edge) => nodes.find((node) => node.id === edge.from)!);
    assert.deepEqual(karolDecisions.map((node) => node.attributes.status).sort(), ['approved', 'approved', 'rejected', 'rejected']);
    assert.equal(graph.getNode('decision:purchase-intercom-2025-06')?.attributes.status, 'rejected');
    assert.equal(graph.getNode('decision:purchase-pipedrive-leadbooster-2025-07')?.attributes.status, 'rejected');
    const context = graph.buildDecisionContext(question);
    const paths = context.evidence.map((item) => item.chunk.path);
    assert.equal(paths.filter((path) => path.includes('pipedrive-invoice')).length, 6);
    assert(context.evidence.some((item) => item.quote.startsWith('Approved: Pipedrive Advanced, five seats')));
    assert(context.evidence.some((item) => item.quote.startsWith('Tomasz Nowak owns the seat list')));
  } finally {
    graph.close();
  }
});

test('May snapshot has no purchase channel data and a mid-window snapshot excludes later invoices', async () => {
  const may = new KnowledgeGraph();
  const august = new KnowledgeGraph();
  try {
    await importSyntheticCorpus(may, '2025-05-12');
    assert.equal(may.getNode(metric), null);
    assert.equal(may.getNode('product:pipedrive'), null);
    await importSyntheticCorpus(august, '2025-08-15');
    const spend = summarizeSpend(august, metric, { from: '2025-02-15', to: '2025-08-15' });
    assert.equal(spend.total, 510);
    assert.equal(august.getNode('decision:purchase-pipedrive-2025-05')?.attributes.monthly_cap_eur, '200');
    assert.equal(august.getNode('decision:purchase-pipedrive-seats-2025-09'), null);
  } finally {
    may.close();
    august.close();
  }
});
