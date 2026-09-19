import assert from 'node:assert/strict';
import test from 'node:test';
import { runSupportPatternWatcher, scanTickets } from '../src/agents/support-pattern-watcher.ts';
import { FOLLOW_UP_DECISION, importSyntheticCorpus } from '../src/corpus/import-synthetic.ts';
import { KnowledgeGraph } from '../src/graph/store.ts';

test('watcher stays quiet on 1 September while the cluster is still small', async () => {
  const graph = new KnowledgeGraph();
  try {
    await importSyntheticCorpus(graph, '2025-09-01');
    const run = await runSupportPatternWatcher(graph, { asOf: '2025-09-01' });
    assert.equal(run.ticketsScanned, 10);
    assert.equal(run.fired, null);
    assert.equal(run.report, null);
    const cluster = run.clusters.find((item) => item.category === 'wrong_case_attachment')!;
    assert.equal(cluster.inWindow.length, 3);
    assert.deepEqual(cluster.customers, ['Gmina Brzozowa', 'Gmina Jasna Dolina']);
    assert.equal(graph.listDocuments({ kind: 'agent_report' }).length, 0);
  } finally {
    graph.close();
  }
});

test('watcher fires on 17 November and files a pending proposal for the open decision', async () => {
  const graph = new KnowledgeGraph();
  try {
    await importSyntheticCorpus(graph, '2025-11-17');
    const run = await runSupportPatternWatcher(graph, { asOf: '2025-11-17' });
    assert.equal(run.fired?.category, 'wrong_case_attachment');
    assert.equal(run.fired?.inWindow.length, 6);
    assert.equal(run.fired?.tickets.length, 9);
    assert.deepEqual(run.fired?.customers, ['Gmina Brzozowa', 'Gmina Jasna Dolina', 'Gmina Lipowa', 'Miasto Zielone Wzgórze']);
    assert.equal(run.report?.kind, 'agent_report');
    assert.equal(run.proposals.length, 2);
    assert(run.proposals.every((proposal) => proposal.status === 'pending'));
    const created = run.proposals.flatMap((proposal) => proposal.diff.nodes.map((node) => node.after.kind));
    assert.deepEqual(created.sort(), ['claim', 'option']);
    // Nothing is in the graph until a human applies it.
    assert.equal(graph.getGraphSnapshot().nodes.filter((node) => node.attributes.agent === 'support-pattern-watcher').length, 0);

    for (const proposal of run.proposals) assert.equal(graph.applyProposal(proposal.id).status, 'applied');
    const { nodes, edges } = graph.getGraphSnapshot();
    const option = nodes.find((node) => node.kind === 'option' && node.attributes.proposed_by === 'support-pattern-watcher')!;
    assert(edges.some((edge) => edge.from === FOLLOW_UP_DECISION && edge.relation === 'considers' && edge.to === option.id));
    const claim = nodes.find((node) => node.attributes.claim_kind === 'ticket_pattern')!;
    assert.equal(claim.attributes.tickets_total, '9');
    assert(edges.some((edge) => edge.from === claim.id && edge.relation === 'informs' && edge.to === FOLLOW_UP_DECISION));
    assert.equal(graph.getNodeEvidence(claim.id).length, 7);

    const context = graph.buildDecisionContext('What are pilot customers repeatedly asking support for and what should we build?');
    assert(context.nodes.some((node) => node.id === option.id));
    assert(context.evidence.some((item) => item.chunk.kind === 'agent_report'));

    const again = await runSupportPatternWatcher(graph, { asOf: '2025-11-17' });
    assert.equal(again.proposals.length, 0, 'replaying the same run date is idempotent');
  } finally {
    graph.close();
  }
});

test('tickets are indexed as searchable sources with parsable metadata', async () => {
  const graph = new KnowledgeGraph();
  try {
    await importSyntheticCorpus(graph, '2025-11-19');
    assert.equal(graph.listDocuments({ kind: 'support_ticket' }).length, 25);
    const scan = scanTickets(graph, { asOf: '2025-11-19' });
    assert.equal(scan.ticketsScanned, 25);
    assert.deepEqual(scan.clusters.map((cluster) => cluster.category).sort(),
      ['delivery_status_delay', 'export_bug', 'login_access', 'training_request', 'wrong_case_attachment']);
    const hits = graph.searchChunks('wrong case attached re-register audit trail', 20);
    assert(hits.filter((hit) => hit.chunk.kind === 'support_ticket').length >= 5);
  } finally {
    graph.close();
  }
});
