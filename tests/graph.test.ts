import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KnowledgeGraph, OpenAIExtractor } from '../src/graph/index.ts';
import type { ExtractionInput, GraphExtractor, GraphPatch, SourceDocument } from '../src/graph/index.ts';

const quote = 'Sales Lead said 12 municipalities were interested.';
const source: SourceDocument = {
  id: 'meeting-2025-05-12', path: 'knowledge/meeting-2025-05-12.md', kind: 'meeting_note',
  content: `---\ndate: 2025-05-12\ntopic: e-Doręczenia\n---\n# Leadership meeting\n${quote}\n`,
};

function seed(graph: KnowledgeGraph): void {
  graph.seedNode({ id: 'product:edoreczenia', kind: 'product', label: 'e-Doręczenia',
    aliases: ['e-delivery'], attributes: {} });
  graph.seedNode({ id: 'decision:build-or-partner', kind: 'decision',
    label: 'Build or partner for e-Doręczenia', aliases: [], attributes: { status: 'open' } });
  graph.seedEdge('decision:build-or-partner', 'about', 'product:edoreczenia');
}

function patchFor(input: ExtractionInput): GraphPatch {
  const sentence = input.chunk.text.includes(quote) ? quote : 'Engineering estimated 16 weeks to build e-Doręczenia.';
  return {
    newNodes: [{ tempId: 'claim1', kind: 'claim', label: sentence,
      aliases: [], attributes: [{ key: 'claim_kind', value: sentence === quote ? 'reported_interest' : 'estimate' }] }],
    edges: [
      { from: 'claim1', relation: 'about', to: 'product:edoreczenia', quote: sentence, basis: 'explicit' },
      { from: 'claim1', relation: 'informs', to: 'decision:build-or-partner', quote: sentence, basis: 'inferred' },
    ],
    nodeEvidence: [{ nodeRef: 'claim1', quote: sentence, role: 'supports' }],
    aliasUpdates: [],
  };
}

const extractor: GraphExtractor = { async extract(input) { return patchFor(input); } };

test('imports source-linked claims and relationships, then retrieves them', async () => {
  const graph = new KnowledgeGraph();
  try {
    seed(graph);
    const proposals = await graph.ingestDocument(source, extractor);
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.status, 'pending');
    assert.equal(graph.getGraphSnapshot().nodes.length, 2);
    const applied = graph.applyProposal(proposals[0]!.id);
    assert.equal(applied.status, 'applied');
    const claim = graph.getGraphSnapshot().nodes.find((node) => node.kind === 'claim');
    assert.ok(claim);
    assert.equal(graph.getNodeEvidence(claim.id)[0]?.quote, quote);
    assert.equal(graph.getNodeEvidence(claim.id)[0]?.quoteStartLine, 6);
    const about = graph.getGraphSnapshot().edges.find((edge) => edge.from === claim.id && edge.relation === 'about');
    assert.ok(about);
    assert.equal(graph.getEdgeEvidence(about.id)[0]?.quote, quote);
    const context = graph.buildDecisionContext('Should we build e-Doręczenia?');
    assert.ok(context.evidence.some((item) => item.quote === quote));
    assert.ok(context.nodes.some((node) => node.id === claim.id));
    assert.equal(context.anchors.some((node) => node.id === 'product:edoreczenia'), true);
    assert.equal((await graph.ingestDocument(source, extractor)).length, 0);
  } finally { graph.close(); }
});

test('rejects invented evidence and duplicate known entities', async () => {
  const graph = new KnowledgeGraph();
  try {
    seed(graph);
    const chunk = graph.indexDocument(source).chunks[0]!;
    await assert.rejects(() => graph.proposeChunk(chunk.id, { async extract(input) {
      const patch = patchFor(input);
      patch.nodeEvidence[0]!.quote = 'This sentence is not in the meeting.';
      return patch;
    } }), /exact nonempty quote/);
    await assert.rejects(() => graph.proposeChunk(chunk.id, { async extract() {
      return {
        newNodes: [{ tempId: 'p1', kind: 'product', label: 'e-Doręczenia', aliases: [], attributes: [] }],
        edges: [], nodeEvidence: [{ nodeRef: 'p1', quote, role: 'mentions' }], aliasUpdates: [],
      };
    } }), /already exists|Potential duplicate/);
    await assert.rejects(() => graph.proposeChunk(chunk.id, { async extract() {
      return {
        newNodes: [{ tempId: 'd1', kind: 'decision', label: 'Approve partner pilot', aliases: [],
          attributes: [{ key: 'status', value: 'approved' }] }],
        edges: [], nodeEvidence: [{ nodeRef: 'd1', quote, role: 'mentions' }], aliasUpdates: [],
      };
    } }), /cannot approve a decision/);
  } finally { graph.close(); }
});

test('independent claims can be applied from two sections of one meeting', async () => {
  const graph = new KnowledgeGraph();
  try {
    seed(graph);
    const twoSections: SourceDocument = { ...source, content: `---\ntopic: e-Doręczenia\n---\n# Sales\n${quote}\n# Engineering\nEngineering estimated 16 weeks to build e-Doręczenia.` };
    const proposals = await graph.ingestDocument(twoSections, extractor);
    assert.equal(proposals.length, 2);
    assert.equal(graph.applyProposal(proposals[0]!.id).status, 'applied');
    assert.equal(graph.applyProposal(proposals[1]!.id).status, 'applied');
    assert.equal(graph.getGraphSnapshot().nodes.filter((node) => node.kind === 'claim').length, 2);
  } finally { graph.close(); }
});

test('a changed entity alias makes a pending proposal stale', async () => {
  const graph = new KnowledgeGraph();
  try {
    seed(graph);
    const aliasSource: SourceDocument = { id: 'alias-note', path: 'knowledge/alias.md', kind: 'note',
      content: '# Product\nOur team calls e-Doręczenia the e-delivery connector.' };
    const aliasProposal = (await graph.ingestDocument(aliasSource, { async extract() {
      return { newNodes: [], edges: [], nodeEvidence: [],
        aliasUpdates: [{ nodeId: 'product:edoreczenia', alias: 'e-delivery connector',
          quote: 'Our team calls e-Doręczenia the e-delivery connector.' }] };
    } }))[0]!;
    const claimProposal = (await graph.ingestDocument(source, extractor))[0]!;
    assert.equal(graph.applyProposal(aliasProposal.id).status, 'applied');
    assert.equal(graph.applyProposal(claimProposal.id).status, 'stale');
  } finally { graph.close(); }
});

test('new source names can become aliases of an existing entity', async () => {
  const graph = new KnowledgeGraph();
  try {
    seed(graph);
    const aliasSource: SourceDocument = { id: 'alias-note', path: 'knowledge/alias.md', kind: 'note',
      content: '# Product\nOur team calls e-Doręczenia the e-delivery connector.' };
    const proposal = (await graph.ingestDocument(aliasSource, { async extract() {
      return { newNodes: [], edges: [], nodeEvidence: [],
        aliasUpdates: [{ nodeId: 'product:edoreczenia', alias: 'e-delivery connector',
          quote: 'Our team calls e-Doręczenia the e-delivery connector.' }] };
    } }))[0]!;
    graph.applyProposal(proposal.id);
    assert.ok(graph.getNode('product:edoreczenia')?.aliases.includes('e-delivery connector'));
    assert.equal(graph.searchNodes('e-delivery connector')[0]?.id, 'product:edoreczenia');
  } finally { graph.close(); }
});

test('changing and restoring a source retires then re-extracts its claim', async () => {
  const graph = new KnowledgeGraph();
  try {
    seed(graph);
    const proposal = (await graph.ingestDocument(source, extractor))[0]!;
    graph.applyProposal(proposal.id);
    const changed = graph.indexDocument({ ...source, content: '# Leadership meeting\nNo demand figure was given.' });
    assert.equal(changed.changed, true);
    assert.equal(changed.toExtract.length, 1);
    assert.equal(graph.getGraphSnapshot().nodes.some((node) => node.kind === 'claim'), false);
    assert.equal(graph.getProposal(proposal.id)?.status, 'superseded');
    assert.equal(graph.getChunk(proposal.chunkId)?.active, false);
    const restored = await graph.ingestDocument(source, extractor);
    assert.equal(restored.length, 1);
    assert.notEqual(restored[0]?.id, proposal.id);
    assert.equal(graph.applyProposal(restored[0]!.id).status, 'applied');
    assert.equal(graph.getGraphSnapshot().nodes.filter((node) => node.kind === 'claim').length, 1);
  } finally { graph.close(); }
});

test('OpenAI adapter sends a structured patch request through an injectable transport', async () => {
  let request: Record<string, unknown> | undefined;
  const fakeFetch: typeof fetch = async (_url, init) => {
    request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({
      newNodes: [], edges: [], nodeEvidence: [], aliasUpdates: [],
    }) }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const graph = new KnowledgeGraph();
  try {
    const chunk = graph.indexDocument(source).chunks[0]!;
    const adapter = new OpenAIExtractor({ apiKey: 'test-key', model: 'test-model', fetchImpl: fakeFetch });
    const result = await adapter.extract({ chunk, existingNodes: [], existingEdges: [] });
    assert.deepEqual(result, { newNodes: [], edges: [], nodeEvidence: [], aliasUpdates: [] });
    assert.equal((request?.text as { format: { type: string } }).format.type, 'json_schema');
  } finally { graph.close(); }
});

test('applied graph and proposal audit survive reopening the SQLite file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'decision-graph-'));
  const databasePath = join(directory, 'graph.sqlite');
  try {
    const first = new KnowledgeGraph(databasePath);
    seed(first);
    const proposal = (await first.ingestDocument(source, extractor))[0]!;
    first.applyProposal(proposal.id);
    first.close();

    const reopened = new KnowledgeGraph(databasePath);
    try {
      assert.equal(reopened.getProposal(proposal.id)?.status, 'applied');
      assert.ok(reopened.buildDecisionContext('e-Doręczenia').evidence.some((item) => item.quote === quote));
    } finally { reopened.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
