import { KnowledgeGraph } from '../graph/store.ts';
import { splitDocument } from '../graph/markdown.ts';
import type { GraphExtractor, GraphPatch, NodeKind } from '../graph/types.ts';
import { loadSyntheticDocuments } from './synthetic.ts';

const mainDecision = 'decision:edoreczenia-build-or-partner';
const earlierDecision = 'decision:digital-signature-build';
export const FOLLOW_UP_DECISION = 'decision:connector-next-step-2025-11';
const pipedriveDecision = 'decision:purchase-pipedrive-2025-05';
const pipedriveSeatsDecision = 'decision:purchase-pipedrive-seats-2025-09';
const leadBoosterDecision = 'decision:purchase-pipedrive-leadbooster-2025-07';
const intercomDecision = 'decision:purchase-intercom-2025-06';
const pipedriveSpend = 'metric:pipedrive-subscription-spend';
export const SYNTHETIC_FIXTURE_VERSION = 3;

interface FixtureEvidence {
  documentId: string;
  quote: string;
  kind: 'claim' | 'observation' | 'action';
  label: string;
  attributes: Record<string, string>;
  /** claim → informs decision; observation → measures decision. */
  decisionId?: string;
  /** observation → measures metric. */
  metricId?: string;
  /** action → assigned_to person. */
  assignedTo?: string;
  /** action → about entity. */
  about?: string;
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
  {
    documentId: 'meeting-pilot-outcome-2025-11-12',
    quote: 'Marta asks Lena to prepare a new decision for 19 November: retain or renegotiate the partner arrangement, build internally, or pause expansion.',
    kind: 'claim', label: 'CEO opened a follow-up decision on the connector for 19 November',
    attributes: { claim_kind: 'decision_request', requested_by: 'Marta Zielińska', due_at: '2025-11-19' },
    decisionId: FOLLOW_UP_DECISION,
  },
  {
    documentId: 'meeting-next-connector-decision-2025-11-19',
    quote: 'Marta asks Tomasz for named purchase commitments, Piotr for an updated build estimate, and Lena for a support and vendor-risk summary.',
    kind: 'claim', label: 'Leadership deferred the connector choice pending three inputs',
    attributes: { claim_kind: 'decision_record', status: 'deferred', decided_at: '2025-11-19', missing_inputs: 'purchase commitments; build estimate; support and vendor-risk summary' },
    decisionId: FOLLOW_UP_DECISION,
  },
  // --- Tooling purchases approved or rejected in #purchase-requests ---
  {
    documentId: 'slack-purchase-pipedrive-2025-05-14',
    quote: 'I am requesting a Pipedrive Advanced subscription for five sales seats at 34 EUR per seat per month, 170 EUR per month in total, to track the named e-Doręczenia pilot pipeline that Marta asked for on 12 May.',
    kind: 'claim', label: 'Sales requested Pipedrive Advanced, five seats at 170 EUR per month',
    attributes: { claim_kind: 'purchase_request', requested_by: 'Tomasz Nowak', monthly_cost_eur: '170', seats: '5', purpose: 'named pilot pipeline tracking' },
    decisionId: pipedriveDecision,
  },
  {
    documentId: 'slack-purchase-pipedrive-2025-05-14',
    quote: 'Monthly billing, no annual commitment, cancel at any time. Invoices go to finance@aster.example and the company card.',
    kind: 'claim', label: 'Pipedrive subscription is monthly with no annual commitment',
    attributes: { claim_kind: 'contract_terms', billing: 'monthly', commitment: 'none' },
    decisionId: pipedriveDecision,
  },
  {
    documentId: 'slack-purchase-pipedrive-2025-05-14',
    quote: 'Approved: Pipedrive Advanced, five seats, monthly billing, spending cap 200 EUR per month.',
    kind: 'claim', label: 'Finance approved Pipedrive with a 200 EUR monthly cap on 15 May',
    attributes: { claim_kind: 'decision_record', status: 'approved', decided_at: '2025-05-15', approver: 'Karol Bąk', monthly_cap_eur: '200' },
    decisionId: pipedriveDecision,
  },
  {
    documentId: 'slack-purchase-pipedrive-2025-05-14',
    quote: 'Tomasz Nowak owns the seat list and a cancellation review after the November pilot outcome.',
    kind: 'action', label: 'Own the Pipedrive seat list and the November cancellation review',
    attributes: { status: 'open', due_at: '2025-11-12', owner: 'Tomasz Nowak' },
    assignedTo: 'person:tomasz-nowak', about: 'product:pipedrive',
  },
  {
    documentId: 'slack-purchase-intercom-2025-06-10',
    quote: 'Requesting an Intercom Essential plan at 74 EUR per month so pilot municipalities can reach Customer Success through in-app chat during onboarding.',
    kind: 'claim', label: 'Customer Success requested Intercom at 74 EUR per month',
    attributes: { claim_kind: 'purchase_request', requested_by: 'Ewa Mazur', monthly_cost_eur: '74' },
    decisionId: intercomDecision,
  },
  {
    documentId: 'slack-purchase-intercom-2025-06-10',
    quote: 'Rejected for now: the pilot cohort can use the existing helpdesk mailbox, and we revisit a chat tool only if paid activations pass ten.',
    kind: 'claim', label: 'Finance rejected Intercom until paid activations pass ten',
    attributes: { claim_kind: 'decision_record', status: 'rejected', decided_at: '2025-06-10', approver: 'Karol Bąk', revisit_condition: 'paid activations > 10' },
    decisionId: intercomDecision,
  },
  {
    documentId: 'slack-purchase-leadbooster-2025-07-08',
    quote: 'Requesting the Pipedrive LeadBooster add-on at 32.50 EUR per month on top of our five seats.',
    kind: 'claim', label: 'Sales requested the Pipedrive LeadBooster add-on at 32.50 EUR per month',
    attributes: { claim_kind: 'purchase_request', requested_by: 'Tomasz Nowak', monthly_cost_eur: '32.50' },
    decisionId: leadBoosterDecision,
  },
  {
    documentId: 'slack-purchase-leadbooster-2025-07-08',
    quote: 'Rejected: the pilot has one paid activation, and the add-on targets inbound leads we are not chasing until the named pipeline converts.',
    kind: 'claim', label: 'Finance rejected the LeadBooster add-on until the pipeline converts',
    attributes: { claim_kind: 'decision_record', status: 'rejected', decided_at: '2025-07-08', approver: 'Karol Bąk', revisit_at: '2025-11-12' },
    decisionId: leadBoosterDecision,
  },
  {
    documentId: 'slack-purchase-pipedrive-seats-2025-09-02',
    quote: 'Requesting three additional Pipedrive Advanced seats for Customer Success at 34 EUR per seat, which takes us from five to eight seats and from 170 EUR to 272 EUR per month.',
    kind: 'claim', label: 'Sales and Customer Success requested three more Pipedrive seats, 272 EUR per month',
    attributes: { claim_kind: 'purchase_request', requested_by: 'Tomasz Nowak', monthly_cost_eur: '272', seats: '8' },
    decisionId: pipedriveSeatsDecision,
  },
  {
    documentId: 'slack-purchase-pipedrive-seats-2025-09-02',
    quote: 'Two of the three activated municipalities slipped by weeks because handoffs lived in email.',
    kind: 'claim', label: 'Onboarding handoffs in email delayed two activated municipalities',
    attributes: { claim_kind: 'problem_statement', evidence_status: 'internal_report' },
    decisionId: pipedriveSeatsDecision,
  },
  {
    documentId: 'slack-purchase-pipedrive-seats-2025-09-02',
    quote: 'Approved: three additional Pipedrive seats from 1 October, eight seats in total, new spending cap 300 EUR per month.',
    kind: 'claim', label: 'Finance approved eight Pipedrive seats with a 300 EUR cap on 3 September',
    attributes: { claim_kind: 'decision_record', status: 'approved', decided_at: '2025-09-03', approver: 'Karol Bąk', monthly_cap_eur: '300' },
    decisionId: pipedriveSeatsDecision,
  },
  {
    documentId: 'email-pipedrive-invoice-2025-06-01',
    quote: 'Total charged for the billing period 1 June 2025 to 30 June 2025: 170.00 EUR for five Advanced seats.',
    kind: 'observation', label: 'Pipedrive invoice PD-2025-06-0417: 170.00 EUR for June 2025',
    attributes: { metric: 'pipedrive_subscription_spend', value: '170.00', currency: 'EUR', observed_at: '2025-06-01', seats: '5', invoice: 'PD-2025-06-0417', period: '1 June 2025 to 30 June 2025' },
    decisionId: pipedriveDecision, metricId: pipedriveSpend,
  },
  {
    documentId: 'email-pipedrive-invoice-2025-07-01',
    quote: 'Total charged for the billing period 1 July 2025 to 31 July 2025: 170.00 EUR for five Advanced seats.',
    kind: 'observation', label: 'Pipedrive invoice PD-2025-07-0522: 170.00 EUR for July 2025',
    attributes: { metric: 'pipedrive_subscription_spend', value: '170.00', currency: 'EUR', observed_at: '2025-07-01', seats: '5', invoice: 'PD-2025-07-0522', period: '1 July 2025 to 31 July 2025' },
    decisionId: pipedriveDecision, metricId: pipedriveSpend,
  },
  {
    documentId: 'email-pipedrive-invoice-2025-08-01',
    quote: 'Total charged for the billing period 1 August 2025 to 31 August 2025: 170.00 EUR for five Advanced seats.',
    kind: 'observation', label: 'Pipedrive invoice PD-2025-08-0639: 170.00 EUR for August 2025',
    attributes: { metric: 'pipedrive_subscription_spend', value: '170.00', currency: 'EUR', observed_at: '2025-08-01', seats: '5', invoice: 'PD-2025-08-0639', period: '1 August 2025 to 31 August 2025' },
    decisionId: pipedriveDecision, metricId: pipedriveSpend,
  },
  {
    documentId: 'email-pipedrive-invoice-2025-09-01',
    quote: 'Total charged for the billing period 1 September 2025 to 30 September 2025: 170.00 EUR for five Advanced seats.',
    kind: 'observation', label: 'Pipedrive invoice PD-2025-09-0741: 170.00 EUR for September 2025',
    attributes: { metric: 'pipedrive_subscription_spend', value: '170.00', currency: 'EUR', observed_at: '2025-09-01', seats: '5', invoice: 'PD-2025-09-0741', period: '1 September 2025 to 30 September 2025' },
    decisionId: pipedriveDecision, metricId: pipedriveSpend,
  },
  {
    documentId: 'email-pipedrive-invoice-2025-10-01',
    quote: 'Total charged for the billing period 1 October 2025 to 31 October 2025: 272.00 EUR for eight Advanced seats.',
    kind: 'observation', label: 'Pipedrive invoice PD-2025-10-0858: 272.00 EUR for October 2025',
    attributes: { metric: 'pipedrive_subscription_spend', value: '272.00', currency: 'EUR', observed_at: '2025-10-01', seats: '8', invoice: 'PD-2025-10-0858', period: '1 October 2025 to 31 October 2025' },
    decisionId: pipedriveDecision, metricId: pipedriveSpend,
  },
  {
    documentId: 'email-pipedrive-invoice-2025-11-01',
    quote: 'Total charged for the billing period 1 November 2025 to 30 November 2025: 272.00 EUR for eight Advanced seats.',
    kind: 'observation', label: 'Pipedrive invoice PD-2025-11-0964: 272.00 EUR for November 2025',
    attributes: { metric: 'pipedrive_subscription_spend', value: '272.00', currency: 'EUR', observed_at: '2025-11-01', seats: '8', invoice: 'PD-2025-11-0964', period: '1 November 2025 to 30 November 2025' },
    decisionId: pipedriveDecision, metricId: pipedriveSpend,
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
    { id: 'person:tomasz-nowak', kind: 'person', label: 'Tomasz Nowak', attributes: { role: 'Sales Lead' } },
    { id: 'person:piotr-kaczmarek', kind: 'person', label: 'Piotr Kaczmarek', attributes: { role: 'Engineering Lead' } },
    { id: 'person:ewa-mazur', kind: 'person', label: 'Ewa Mazur', attributes: { role: 'Customer Success Lead' } },
    { id: 'person:aneta-krol', kind: 'person', label: 'Aneta Król', attributes: { role: 'Security Lead' } },
    { id: 'person:karol-bak', kind: 'person', label: 'Karol Bąk', aliases: ['CFO', 'Finance'], attributes: { role: 'Finance Lead', approves: 'tooling purchases' } },
  ];
  for (const entity of entities) graph.seedNode({ ...entity, aliases: entity.aliases ?? [], attributes: entity.attributes ?? {} });

  graph.seedNode({ id: earlierDecision, kind: 'decision', label: 'Build digital-signature feature',
    aliases: [], attributes: { status: 'approved', decided_at: '2024-04-18', owner: 'Lena Wójcik' } });
  graph.seedEdge(earlierDecision, 'assigned_to', 'person:marta-zielinska');
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
  if (asOf >= '2025-11-12') {
    graph.seedNode({ id: FOLLOW_UP_DECISION, kind: 'decision',
      label: 'Retain the partner connector, build internally, or pause e-Doręczenia expansion',
      aliases: ['connector next step', 'November connector decision'],
      attributes: { status: 'open', opened_at: '2025-11-12', review_at: '2025-11-19', owner: 'Lena Wójcik' } });
    graph.seedEdge(FOLLOW_UP_DECISION, 'about', 'product:edoreczenia');
    graph.seedEdge(FOLLOW_UP_DECISION, 'assigned_to', 'person:marta-zielinska');
    for (const [id, label] of [
      ['option:retain-partner', 'Retain or renegotiate the ConnectorCo arrangement'],
      ['option:build-internal-connector', 'Replace the partner connector with an internal build'],
      ['option:pause-expansion', 'Pause connector expansion'],
    ]) {
      graph.seedNode({ id, kind: 'option', label, aliases: [], attributes: {} });
      graph.seedEdge(FOLLOW_UP_DECISION, 'considers', id);
    }
  }
  seedPurchases(graph, asOf);
}

/** Tooling purchase decisions from #purchase-requests. Karol Bąk (Finance Lead) approves or rejects. */
function seedPurchases(graph: KnowledgeGraph, asOf: string): void {
  if (asOf < '2025-05-14') return;
  graph.seedNode({ id: 'product:pipedrive', kind: 'product', label: 'Pipedrive', aliases: ['Pipedrive CRM', 'Pipedrive Advanced'],
    attributes: { category: 'crm', vendor: 'Pipedrive', billing: 'monthly', currency: 'EUR' } });
  if (asOf >= '2025-06-10') {
    graph.seedNode({ id: 'product:intercom', kind: 'product', label: 'Intercom', aliases: ['Intercom Essential'],
      attributes: { category: 'customer_chat', vendor: 'Intercom' } });
  }
  graph.seedNode({ id: pipedriveSpend, kind: 'metric', label: 'Pipedrive subscription spend',
    aliases: ['Pipedrive cost', 'Pipedrive invoices'], attributes: { unit: 'EUR', period: 'monthly', source: 'Pipedrive invoices to finance@aster.example' } });
  graph.seedNode({ id: pipedriveDecision, kind: 'decision', label: 'Approve Pipedrive CRM subscription for sales',
    aliases: ['Pipedrive purchase request'], attributes: asOf >= '2025-05-15'
      ? { status: 'approved', decided_at: '2025-05-15', approver: 'Karol Bąk', requested_by: 'Tomasz Nowak', owner: 'Tomasz Nowak',
          monthly_cap_eur: asOf >= '2025-09-03' ? '300' : '200', seats: asOf >= '2025-10-01' ? '8' : '5', starts_at: '2025-06-01' }
      : { status: 'open', requested_by: 'Tomasz Nowak' } });
  graph.seedEdge(pipedriveDecision, 'about', 'product:pipedrive');
  graph.seedEdge(pipedriveDecision, 'assigned_to', 'person:karol-bak');
  graph.seedEdge(pipedriveDecision, 'targets', pipedriveSpend);

  if (asOf >= '2025-06-10') {
    graph.seedNode({ id: intercomDecision, kind: 'decision', label: 'Approve Intercom chat for pilot onboarding',
      aliases: ['Intercom purchase request'], attributes: { status: 'rejected', decided_at: '2025-06-10', approver: 'Karol Bąk',
        requested_by: 'Ewa Mazur', revisit_condition: 'paid activations > 10' } });
    graph.seedEdge(intercomDecision, 'about', 'product:intercom');
    graph.seedEdge(intercomDecision, 'assigned_to', 'person:karol-bak');
  }
  if (asOf >= '2025-07-08') {
    graph.seedNode({ id: leadBoosterDecision, kind: 'decision', label: 'Approve Pipedrive LeadBooster add-on',
      aliases: ['LeadBooster request'], attributes: { status: 'rejected', decided_at: '2025-07-08', approver: 'Karol Bąk',
        requested_by: 'Tomasz Nowak', revisit_at: '2025-11-12' } });
    graph.seedEdge(leadBoosterDecision, 'about', 'product:pipedrive');
    graph.seedEdge(leadBoosterDecision, 'assigned_to', 'person:karol-bak');
  }
  if (asOf >= '2025-09-02') {
    graph.seedNode({ id: pipedriveSeatsDecision, kind: 'decision', label: 'Approve three more Pipedrive seats for Customer Success',
      aliases: ['Pipedrive seat increase'], attributes: asOf >= '2025-09-03'
        ? { status: 'approved', decided_at: '2025-09-03', approver: 'Karol Bąk', requested_by: 'Tomasz Nowak', owner: 'Tomasz Nowak',
            monthly_cap_eur: '300', seats: '8', effective_at: '2025-10-01' }
        : { status: 'open', requested_by: 'Tomasz Nowak' } });
    graph.seedEdge(pipedriveSeatsDecision, 'about', 'product:pipedrive');
    graph.seedEdge(pipedriveSeatsDecision, 'assigned_to', 'person:karol-bak');
    graph.seedEdge(pipedriveSeatsDecision, 'targets', pipedriveSpend);
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
      const edges: GraphPatch['edges'] = specs.flatMap((spec, index) => {
        const from = `e${index + 1}`;
        const edgeSet: GraphPatch['edges'] = [];
        if (spec.kind === 'claim' && spec.decisionId) {
          edgeSet.push({ from, relation: 'informs', to: spec.decisionId, quote: spec.quote, basis: 'inferred' });
        }
        if (spec.kind === 'observation') {
          if (spec.decisionId) edgeSet.push({ from, relation: 'measures', to: spec.decisionId, quote: spec.quote, basis: 'explicit' });
          if (spec.metricId) edgeSet.push({ from, relation: 'measures', to: spec.metricId, quote: spec.quote, basis: 'explicit' });
        }
        if (spec.kind === 'action') {
          if (spec.assignedTo) edgeSet.push({ from, relation: 'assigned_to', to: spec.assignedTo, quote: spec.quote, basis: 'explicit' });
          if (spec.about) edgeSet.push({ from, relation: 'about', to: spec.about, quote: spec.quote, basis: 'explicit' });
        }
        return edgeSet;
      });
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
