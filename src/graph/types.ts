export const NODE_KINDS = [
  'person', 'organization', 'product', 'project', 'customer_segment',
  'claim', 'decision', 'option', 'metric', 'observation', 'action',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const RELATIONS = [
  'about', 'informs', 'considers', 'relies_on', 'targets', 'measures',
  'assigned_to', 'in_tension_with', 'contradicts', 'supersedes', 'works_on',
] as const;
export type Relation = (typeof RELATIONS)[number];
export type ReviewStatus = 'unreviewed' | 'reviewed' | 'disputed';
export type EvidenceRole = 'supports' | 'opposes' | 'mentions' | 'inferred';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  aliases: string[];
  attributes: Record<string, string>;
  reviewStatus: ReviewStatus;
  version: number;
  origin: 'seed' | 'extracted' | 'manual';
}

export interface GraphEdge {
  id: string;
  from: string;
  relation: Relation;
  to: string;
  version: number;
  origin: 'seed' | 'extracted' | 'manual';
}

export interface SourceDocument {
  id: string;
  path: string;
  kind: 'meeting_note' | 'note' | 'slack' | 'email' | 'external' | 'kpi' | 'decision_record';
  content: string;
  authoredAt?: string;
  url?: string;
}

export interface SourceChunk {
  id: string;
  documentId: string;
  path: string;
  kind: SourceDocument['kind'];
  heading: string;
  context: { topic: string; participants: string[] };
  startLine: number;
  endLine: number;
  text: string;
  authoredAt: string | null;
  active: boolean;
}

export interface PatchNode {
  tempId: string;
  kind: NodeKind;
  label: string;
  aliases: string[];
  attributes: { key: string; value: string }[];
}

export interface PatchEdge {
  from: string;
  relation: Relation;
  to: string;
  quote: string;
  basis: 'explicit' | 'inferred';
}

export interface PatchNodeEvidence {
  nodeRef: string;
  quote: string;
  role: EvidenceRole;
}

export interface GraphPatch {
  newNodes: PatchNode[];
  edges: PatchEdge[];
  nodeEvidence: PatchNodeEvidence[];
  aliasUpdates: { nodeId: string; alias: string; quote: string }[];
}

export interface ExtractionInput {
  chunk: SourceChunk;
  existingNodes: GraphNode[];
  existingEdges: GraphEdge[];
}

export interface GraphExtractor {
  extract(input: ExtractionInput): Promise<GraphPatch>;
}

export interface ProposalDiff {
  nodes: { operation: 'create'; tempId: string; id: string; before: null;
    after: { kind: NodeKind; label: string; aliases: string[]; attributes: Record<string, string> } }[];
  edges: { operation: 'create' | 'reuse'; from: string; relation: Relation; to: string;
    before: null | { id: string }; after: { id: string } }[];
  aliases: { nodeId: string; before: string[]; after: string[] }[];
}

export interface IngestionProposal {
  id: string;
  chunkId: string;
  status: 'pending' | 'applied' | 'rejected' | 'stale' | 'superseded';
  patch: GraphPatch;
  diff: ProposalDiff;
  readSet: { id: string; version: number }[];
  createdAt: string;
  appliedAt: string | null;
}

export interface SearchHit { chunk: SourceChunk; rank: number }

export interface EvidenceItem {
  chunk: SourceChunk;
  quote: string;
  quoteStartLine: number;
  quoteEndLine: number;
  role: EvidenceRole;
  nodeId?: string;
  edgeId?: string;
}

export interface DecisionContext {
  question: string;
  anchors: GraphNode[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  evidence: EvidenceItem[];
  searchedSources: number;
}
