import { KnowledgeGraph } from '../graph/store.ts';
import { splitDocument } from '../graph/markdown.ts';
import type { GraphExtractor, GraphPatch, NodeKind } from '../graph/types.ts';
import { loadSyntheticDocuments } from './synthetic.ts';

const mainDecision = 'decision:edoreczenia-build-or-partner';
const earlierDecision = 'decision:digital-signature-build';
export const SYNTHETIC_FIXTURE_VERSION = 2;

interface FixtureEvidence {
  documentId: string;
  quote: string;
  kind: 'claim' | 'observation';
  label: string;
  attributes: Record<string, string>;
  decisionId: string;
}

/** Reviewed, deterministic extraction for the fictional demo. Other source text is indexed for search. */
const fixtureEvidence: FixtureEvidence[] = [
  {
    documentId: 'aster-external-signal-2025-04-16',
    quote: 'Lena Wójcik flagged the public e-Doręczenia rollout as relevant to municipal document workflows.',
    kind: 'claim', label: 'Product team identified a possible e-Doręczenia workflow opportunity',
    attributes: { claim_kind: 'opportunity_hypothesis', evidence_status: 'internal_interpretation' },
    decisionId: mainDecision,
  },
  {
    documentId: 'slack-sales-demand-2025-05-02',
    quote: 'I count 12 municipalities interested in an e-Doręczenia workflow with CivicFlow. This is from account conversations, not twelve orders.',
    kind: 'claim', label: 'Sales reported 12 municipalities interested, without 12 orders',
    attributes: { claim_kind: 'reported_interest', value: '12', evidence_status: 'unverified' },
    decisionId: mainDecision,
  },
  {
    documentId: 'slack-sales-demand-2025-05-02',
    quote: 'In the shared inbox I can point to four written requests from Brzozowa, Srebrne Pole, Jasna Dolina, and Zielone Wzgórze.',
    kind: 'claim', label: 'Customer Success identified four named written requests',
    attributes: { claim_kind: 'written_request_count', value: '4', evidence_status: 'source_listed' },
    decisionId: mainDecision,
  },
  {
    documentId: 'email-brzozowa-request-2025-04-24',
    quote: 'We would like incoming messages to appear in the relevant CivicFlow case with an audit trail instead of staff copying attachments by hand.',
    kind: 'claim', label: 'Gmina Brzozowa requested integrated case filing',
    attributes: { claim_kind: 'customer_request', customer: 'Gmina Brzozowa', evidence_status: 'direct_email' },
    decisionId: mainDecision,
  },
  {
    documentId: 'email-srebrne-pole-request-2025-04-25',
    quote: 'Can Aster connect official e-Doręczenia messages to our CivicFlow document register?',
    kind: 'claim', label: 'Miasto Srebrne Pole requested a CivicFlow connector',
    attributes: { claim_kind: 'customer_request', customer: 'Miasto Srebrne Pole', evidence_status: 'direct_email' },
    decisionId: mainDecision,
  },
  {
    documentId: 'email-jasna-dolina-request-2025-04-29',
    quote: 'Please add our interest in an integrated e-Doręczenia queue for CivicFlow.',
    kind: 'claim', label: 'Gmina Jasna Dolina requested an integrated queue',
    attributes: { claim_kind: 'customer_request', customer: 'Gmina Jasna Dolina', evidence_status: 'direct_email' },
    decisionId: mainDecision,
  },
  {
    documentId: 'email-zielone-wzgorze-request-2025-05-02',
    quote: 'Our records team would like e-Doręczenia correspondence to arrive in CivicFlow without duplicate manual registration.',
    kind: 'claim', label: 'Miasto Zielone Wzgórze requested automatic registration',
    attributes: { claim_kind: 'customer_request', customer: 'Miasto Zielone Wzgórze', evidence_status: 'direct_email' },
    decisionId: mainDecision,
  },
  {
    documentId: 'email-engineering-estimate-2025-05-06',
    quote: 'My preliminary estimate for a supported internal connector is 16 weeks with two dedicated engineers from kickoff.',
    kind: 'claim', label: 'Engineering estimated 16 weeks and two engineers for an internal build',
    attributes: { claim_kind: 'estimate', duration_weeks: '16', engineers: '2' },
    decisionId: mainDecision,
  },
  {
    documentId: 'email-connectorco-offer-2025-05-05',
    quote: 'ConnectorCo can propose a six-week implementation path from joint kickoff for a limited CivicFlow pilot.',
    kind: 'claim', label: 'ConnectorCo proposed a six-week limited pilot path',
    attributes: { claim_kind: 'vendor_estimate', duration_weeks: '6', evidence_status: 'conditional_offer' },
    decisionId: mainDecision,
  },
  {
    documentId: 'aster-digital-signature-retrospective-2025-04-18',
    quote: 'The billing report on 18 April 2025 shows 14 paid customers for that feature.',
    kind: 'observation', label: 'Digital-signature feature reached 14 paid customers after one year',
    attributes: { metric: 'paid_customers', value: '14', observed_at: '2025-04-18', target: '25' },
    decisionId: earlierDecision,
  },
  {
    documentId: 'aster-digital-signature-retrospective-2025-04-18',
    quote: 'The forecast missed by 11 customers.',
    kind: 'claim', label: 'Earlier digital-signature uptake missed its forecast by 11 customers',
    attributes: { claim_kind: 'past_outcome', forecast: '25', actual: '14', shortfall: '11' },
    decisionId: mainDecision,
  },
  {
    documentId: 'aster-edoreczenia-option-model-2025-05-09',
    quote: 'The 22-customer partner forecast is a scenario, not validated demand.',
    kind: 'claim', label: 'Partner model assumes 22 paid customers in the first year',
    attributes: { claim_kind: 'assumption', forecast_paid_customers: '22', horizon: '12_months' },
    decisionId: mainDecision,
  },
  {
    documentId: 'meeting-edoreczenia-decision-2025-05-12',
    quote: 'Marta approved **a paid partner pilot with ConnectorCo**, conditional on a security and contract gate by 20 May.',
    kind: 'claim', label: 'CEO approved a gated paid partner pilot on 12 May',
    attributes: { claim_kind: 'decision_record', status: 'approved', decided_at: '2025-05-12' },
    decisionId: mainDecision,
  },
  {
    documentId: 'meeting-edoreczenia-decision-2025-05-12',
    quote: 'Target: **10 paid municipal activations by 12 November 2025**, six months after this decision.',
    kind: 'claim', label: 'Partner pilot targets 10 paid activations at six months',
    attributes: { claim_kind: 'kpi_target', metric: 'paid_municipal_activations', value: '10', due_at: '2025-11-12' },
    decisionId: mainDecision,
  },
  {
    documentId: 'meeting-pilot-outcome-2025-11-12',
    quote: "Karol's billing export shows **six paid municipal activations as of 12 November 2025**.",
    kind: 'observation', label: 'Partner pilot reached 6 paid activations at six months',
    attributes: { metric: 'paid_municipal_activations', value: '6', observed_at: '2025-11-12', target: '10' },
    decisionId: mainDecision,
  },
];

function seed(graph: KnowledgeGraph, asOf: string): void {
  const entities: { id: string; kind: NodeKind; label: string; aliases?: string[]; attributes?: Record<string, string> }[] = [
    { id: 'organization:aster-systems', kind: 'organization', label: 'Aster Systems', attributes: { role: 'company' } },
    { id: 'organization:connectorco', kind: 'organization', label: 'ConnectorCo', attributes: { role: 'vendor' } },
    { id: 'organization:brzozowa', kind: 'organization', label: 'Gmina Brzozowa', attributes: { role: 'customer' } },
    { id: 'organization:srebrne-pole', kind: 'organization', label: 'Miasto Srebrne Pole', attributes: { role: 'customer' } },
    { id: 'organization:jasna-dolina', kind: 'organization', label: 'Gmina Jasna Dolina', attributes: { role: 'customer' } },
    { id: 'organization:zielone-wzgorze', kind: 'organization', label: 'Miasto Zielone Wzgórze', attributes: { role: 'customer' } },
    { id: 'product:civicflow', kind: 'product', label: 'CivicFlow', attributes: {} },
    { id: 'product:edoreczenia', kind: 'product', label: 'e-Doręczenia integration', aliases: ['e-delivery connector'], attributes: {} },
    { id: 'person:marta-zielinska', kind: 'person', label: 'Marta Zielińska', attributes: { role: 'CEO' } },
    { id: 'person:lena-wojcik', kind: 'person', label: 'Lena Wójcik', attributes: { role: 'Product Lead' } },
  ];
  for (const entity of entities) graph.seedNode({ ...entity, aliases: entity.aliases ?? [], attributes: entity.attributes ?? {} });

  graph.seedNode({ id: earlierDecision, kind: 'decision', label: 'Build digital-signature feature',
    aliases: [], attributes: { status: 'approved', decided_at: '2024-04-18' } });
  graph.seedNode({ id: mainDecision, kind: 'decision', label: 'Build, partner, or postpone e-Doręczenia integration',
    aliases: ['CivicFlow connector decision'], attributes: asOf >= '2025-05-12'
      ? { status: 'approved', selected_option: 'option:partner', decided_at: '2025-05-12', owner: 'Lena Wójcik' }
      : { status: 'open' } });
  graph.seedEdge(mainDecision, 'about', 'product:edoreczenia');
  graph.seedEdge(mainDecision, 'assigned_to', 'person:marta-zielinska');
  if (asOf >= '2025-05-09') {
    for (const [id, label] of [
      ['option:build', 'Build internally'], ['option:partner', 'Partner with ConnectorCo'],
      ['option:postpone', 'Postpone'],
    ]) {
      graph.seedNode({ id, kind: 'option', label, aliases: [], attributes: {} });
      graph.seedEdge(mainDecision, 'considers', id);
    }
  }
  if (asOf >= '2025-05-12') {
    graph.seedNode({ id: 'metric:paid-municipal-activations', kind: 'metric',
      label: 'Paid municipal activations', aliases: [], attributes: { unit: 'customers' } });
    graph.seedEdge(mainDecision, 'targets', 'metric:paid-municipal-activations');
  }
}

export interface SyntheticImportSummary {
  documents: number;
  chunks: number;
  evidenceNodes: number;
  graphNodes: number;
  graphEdges: number;
}

/**
 * Import every dated source. The checked-in fixture supplies reviewed graph facts for the
 * central demo; all other Slack/email/meeting text is still indexed and searchable.
 * Use a fresh database for each `asOf` value to avoid retaining later sources.
 */
export async function importSyntheticCorpus(
  graph: KnowledgeGraph,
  asOf = '2025-11-19',
): Promise<SyntheticImportSummary> {
  const documents = await loadSyntheticDocuments({ asOf });
  const includedEvidence = fixtureEvidence.filter((spec) => documents.some((document) => document.id === spec.documentId));
  for (const spec of includedEvidence) {
    const document = documents.find((item) => item.id === spec.documentId)!;
    if (!splitDocument(document).some((chunk) => chunk.text.includes(spec.quote))) {
      throw new Error(`Synthetic evidence quote missing: ${spec.documentId}`);
    }
  }
  seed(graph, asOf);
  const extractor: GraphExtractor = {
    async extract({ chunk }): Promise<GraphPatch> {
      const specs = fixtureEvidence.filter((spec) => spec.documentId === chunk.documentId && chunk.text.includes(spec.quote));
      const newNodes = specs.map((spec, index) => ({
        tempId: `e${index + 1}`,
        kind: spec.kind,
        label: spec.label,
        aliases: [],
        attributes: Object.entries(spec.attributes).map(([key, value]) => ({ key, value })),
      }));
      const edges: GraphPatch['edges'] = specs.map((spec, index) => ({
        from: `e${index + 1}`,
        relation: spec.kind === 'observation' ? 'measures' : 'informs',
        to: spec.decisionId,
        quote: spec.quote,
        basis: spec.kind === 'observation' ? 'explicit' : 'inferred',
      }));
      if (chunk.documentId === 'slack-sales-demand-2025-05-02' && specs.length === 2) {
        edges.push({ from: 'e1', relation: 'in_tension_with', to: 'e2',
          quote: specs[1]!.quote, basis: 'inferred' });
      }
      return {
        newNodes,
        edges,
        nodeEvidence: specs.map((spec, index) => ({ nodeRef: `e${index + 1}`, quote: spec.quote, role: 'supports' })),
        aliasUpdates: [],
      };
    },
  };

  let chunks = 0;
  for (const document of documents) {
    const proposals = await graph.ingestDocument(document, extractor, true);
    chunks += proposals.length;
    if (proposals.some((proposal) => proposal.status !== 'applied')) {
      throw new Error(`Synthetic import did not apply all proposals for ${document.id}`);
    }
  }
  const snapshot = graph.getGraphSnapshot();
  return { documents: documents.length, chunks, evidenceNodes: includedEvidence.length,
    graphNodes: snapshot.nodes.length, graphEdges: snapshot.edges.length };
}
