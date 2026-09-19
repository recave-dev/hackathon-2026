import { readFileSync } from 'node:fs';
import { KnowledgeGraph, OpenAIExtractor } from '../src/graph/index.ts';
import type { GraphExtractor, GraphPatch } from '../src/graph/index.ts';

const filePath = new URL('../knowledge/demo-meeting.md', import.meta.url);
const graph = new KnowledgeGraph();
graph.seedNode({ id: 'product:edoreczenia', kind: 'product', label: 'e-Doręczenia integration',
  aliases: ['e-delivery connector'], attributes: {} });
graph.seedNode({ id: 'decision:edoreczenia-build-or-partner', kind: 'decision',
  label: 'Build or partner for e-Doręczenia integration', aliases: [], attributes: { status: 'open' } });
graph.seedEdge('decision:edoreczenia-build-or-partner', 'about', 'product:edoreczenia');

const salesQuote = 'Sales Lead said 12 municipalities were interested.';
const fixtureExtractor: GraphExtractor = {
  async extract(input): Promise<GraphPatch> {
    if (!input.chunk.text.includes(salesQuote)) {
      return { newNodes: [], edges: [], nodeEvidence: [], aliasUpdates: [] };
    }
    return {
      newNodes: [{ tempId: 'sales_interest', kind: 'claim',
        label: 'Sales Lead reported 12 interested municipalities', aliases: [],
        attributes: [{ key: 'claim_kind', value: 'reported_interest' },
          { key: 'evidence_status', value: 'unverified' }] }],
      edges: [
        { from: 'sales_interest', relation: 'about', to: 'product:edoreczenia',
          quote: salesQuote, basis: 'explicit' },
        { from: 'sales_interest', relation: 'informs', to: 'decision:edoreczenia-build-or-partner',
          quote: salesQuote, basis: 'inferred' },
      ],
      nodeEvidence: [{ nodeRef: 'sales_interest', quote: salesQuote, role: 'supports' }],
      aliasUpdates: [],
    };
  },
};

const live = process.argv.includes('--live');
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;
if (live && (!apiKey || !model)) throw new Error('--live requires OPENAI_API_KEY and OPENAI_MODEL');
const extractor = live ? new OpenAIExtractor({ apiKey: apiKey!, model: model! }) : fixtureExtractor;

try {
  const proposals = await graph.ingestDocument({
    id: 'meeting-2025-05-12-leadership', path: 'knowledge/demo-meeting.md', kind: 'meeting_note',
    content: readFileSync(filePath, 'utf8'),
  }, extractor);
  for (const proposal of proposals) {
    console.log('Proposed change:', JSON.stringify(proposal.diff));
    graph.applyProposal(proposal.id);
  }
  const context = graph.buildDecisionContext('Should we build the e-Doręczenia integration?');
  console.log('Relevant graph nodes:', context.nodes.map((node) => `${node.kind}:${node.label}`));
  console.log('Cited evidence:', context.evidence.map((item) => `${item.chunk.path}:${item.quoteStartLine} ${item.quote}`));
  if (!live) console.log('Extractor: deterministic demo fixture. Pass --live to call OpenAI.');
} finally { graph.close(); }
