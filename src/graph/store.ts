import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hash, splitDocument } from './markdown.ts';
import { allowsRelation, isNodeKind, isRelation, nodeKey, normalizeName } from './ontology.ts';
import type {
  DecisionContext, EvidenceItem, ExtractionInput, GraphEdge, GraphExtractor, GraphNode,
  GraphPatch, IngestionProposal, NodeKind, PatchNode, ProposalDiff, Relation,
  SearchHit, SourceChunk, SourceDocument,
} from './types.ts';

type Row = Record<string, unknown>;

function json<T>(value: unknown): T { return JSON.parse(String(value)) as T; }
function now(): string { return new Date().toISOString(); }
function string(value: unknown): string { return String(value ?? ''); }

function mapNode(row: Row): GraphNode {
  return {
    id: string(row.id), kind: row.kind as NodeKind, label: string(row.label),
    aliases: json<string[]>(row.aliases_json), attributes: json<Record<string, string>>(row.attributes_json),
    reviewStatus: row.review_status as GraphNode['reviewStatus'], version: Number(row.version),
    origin: row.origin as GraphNode['origin'],
  };
}

function mapEdge(row: Row): GraphEdge {
  return {
    id: string(row.id), from: string(row.from_id), relation: row.relation as Relation,
    to: string(row.to_id), version: Number(row.version), origin: row.origin as GraphEdge['origin'],
  };
}

function mapChunk(row: Row): SourceChunk {
  return {
    id: string(row.id), documentId: string(row.document_id), path: string(row.path),
    kind: row.kind as SourceDocument['kind'], heading: string(row.heading),
    context: json<SourceChunk['context']>(row.context_json),
    startLine: Number(row.start_line), endLine: Number(row.end_line), text: string(row.text),
    authoredAt: row.authored_at == null ? null : string(row.authored_at), active: Boolean(row.active),
  };
}

function mapProposal(row: Row): IngestionProposal {
  return {
    id: string(row.id), chunkId: string(row.chunk_id), status: row.status as IngestionProposal['status'],
    patch: json<GraphPatch>(row.patch_json), diff: json<ProposalDiff>(row.diff_json),
    readSet: json<IngestionProposal['readSet']>(row.read_set_json),
    createdAt: string(row.created_at), appliedAt: row.applied_at == null ? null : string(row.applied_at),
  };
}

function evidenceItem(row: Row, owner: { nodeId?: string; edgeId?: string }): EvidenceItem {
  const chunk = mapChunk(row);
  const quote = string(row.quote);
  const offset = Math.max(0, chunk.text.indexOf(quote));
  const quoteStartLine = chunk.startLine + (chunk.text.slice(0, offset).match(/\n/g)?.length ?? 0);
  return { ...owner, chunk, quote, quoteStartLine,
    quoteEndLine: quoteStartLine + (quote.match(/\n/g)?.length ?? 0),
    role: row.role as EvidenceItem['role'] };
}

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, path TEXT NOT NULL, kind TEXT NOT NULL, authored_at TEXT,
  url TEXT, sha256 TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
  heading TEXT NOT NULL, context_json TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL,
  text TEXT NOT NULL, authored_at TEXT, active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS chunks_by_document ON chunks(document_id, active);
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_search USING fts5(chunk_id UNINDEXED, text);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL,
  aliases_json TEXT NOT NULL, attributes_json TEXT NOT NULL,
  review_status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  origin TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY, from_id TEXT NOT NULL REFERENCES nodes(id),
  relation TEXT NOT NULL, to_id TEXT NOT NULL REFERENCES nodes(id),
  version INTEGER NOT NULL DEFAULT 1, origin TEXT NOT NULL,
  UNIQUE(from_id, relation, to_id)
);
CREATE INDEX IF NOT EXISTS edges_from ON edges(from_id);
CREATE INDEX IF NOT EXISTS edges_to ON edges(to_id);
CREATE TABLE IF NOT EXISTS node_evidence (
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES chunks(id), quote TEXT NOT NULL,
  role TEXT NOT NULL, PRIMARY KEY(node_id, chunk_id, quote, role)
);
CREATE TABLE IF NOT EXISTS edge_evidence (
  edge_id TEXT NOT NULL REFERENCES edges(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES chunks(id), quote TEXT NOT NULL,
  role TEXT NOT NULL, PRIMARY KEY(edge_id, chunk_id, quote, role)
);
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id TEXT PRIMARY KEY, chunk_id TEXT NOT NULL REFERENCES chunks(id),
  source_hash TEXT NOT NULL, read_set_json TEXT NOT NULL,
  patch_json TEXT NOT NULL, diff_json TEXT NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL, applied_at TEXT
);
CREATE INDEX IF NOT EXISTS runs_by_chunk ON ingestion_runs(chunk_id, status);
`;

export class KnowledgeGraph {
  private readonly db: DatabaseSync;

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
  }

  close(): void { this.db.close(); }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  seedNode(node: Omit<GraphNode, 'version' | 'origin' | 'reviewStatus'> & { reviewStatus?: GraphNode['reviewStatus'] }): GraphNode {
    if (!isNodeKind(node.kind)) throw new Error(`Invalid node kind: ${node.kind}`);
    const existing = this.getNode(node.id);
    if (existing) {
      if (existing.kind !== node.kind) throw new Error(`Node ${node.id} already has a different kind`);
      return existing;
    }
    this.db.prepare(`INSERT INTO nodes(id, kind, label, aliases_json, attributes_json, review_status, origin)
      VALUES (?, ?, ?, ?, ?, ?, 'seed')`).run(
      node.id, node.kind, node.label, JSON.stringify(node.aliases), JSON.stringify(node.attributes), node.reviewStatus ?? 'reviewed',
    );
    return this.getNode(node.id)!;
  }

  seedEdge(from: string, relation: Relation, to: string): GraphEdge {
    const fromNode = this.getNode(from);
    const toNode = this.getNode(to);
    if (!fromNode || !toNode || !isRelation(relation) || !allowsRelation(relation, fromNode.kind, toNode.kind)) {
      throw new Error(`Invalid seed edge: ${from} ${relation} ${to}`);
    }
    const id = this.edgeId(from, relation, to);
    this.db.prepare(`INSERT OR IGNORE INTO edges(id, from_id, relation, to_id, origin)
      VALUES (?, ?, ?, ?, 'seed')`).run(id, from, relation, to);
    return this.getEdge(id)!;
  }

  getNode(id: string): GraphNode | null {
    const row = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Row | undefined;
    return row ? mapNode(row) : null;
  }

  getEdge(id: string): GraphEdge | null {
    const row = this.db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as Row | undefined;
    return row ? mapEdge(row) : null;
  }

  getChunk(id: string): SourceChunk | null {
    const row = this.db.prepare(`SELECT c.*, d.path, d.kind FROM chunks c
      JOIN documents d ON d.id = c.document_id WHERE c.id = ?`).get(id) as Row | undefined;
    return row ? mapChunk(row) : null;
  }

  getProposal(id: string): IngestionProposal | null {
    const row = this.db.prepare('SELECT * FROM ingestion_runs WHERE id = ?').get(id) as Row | undefined;
    return row ? mapProposal(row) : null;
  }

  listProposals(status?: IngestionProposal['status']): IngestionProposal[] {
    const rows = status
      ? this.db.prepare('SELECT * FROM ingestion_runs WHERE status = ? ORDER BY created_at').all(status)
      : this.db.prepare('SELECT * FROM ingestion_runs ORDER BY created_at').all();
    return (rows as Row[]).map(mapProposal);
  }

  indexDocument(source: SourceDocument): { changed: boolean; chunks: SourceChunk[]; toExtract: SourceChunk[] } {
    if (!source.id.trim() || !source.path.trim()) throw new Error('Source ID and path are required');
    const contentHash = hash(source.content);
    const existing = this.db.prepare('SELECT sha256 FROM documents WHERE id = ?').get(source.id) as Row | undefined;
    if (existing && existing.sha256 === contentHash) {
      const rows = this.db.prepare(`SELECT c.*, d.path, d.kind FROM chunks c JOIN documents d ON d.id = c.document_id
        WHERE c.document_id = ? AND c.active = 1 ORDER BY c.start_line`).all(source.id) as Row[];
      return { changed: false, chunks: rows.map(mapChunk), toExtract: [] };
    }
    const chunks = splitDocument(source);
    return this.transaction(() => {
      const toExtract: SourceChunk[] = [];
      if (existing) {
        const old = this.db.prepare('SELECT id FROM chunks WHERE document_id = ? AND active = 1').all(source.id) as Row[];
        const currentIds = new Set(chunks.map((chunk) => chunk.id));
        for (const row of old) {
          const oldId = string(row.id);
          if (currentIds.has(oldId)) continue;
          this.db.prepare(`UPDATE ingestion_runs SET status = 'stale' WHERE chunk_id = ? AND status = 'pending'`).run(oldId);
          this.db.prepare(`UPDATE ingestion_runs SET status = 'superseded' WHERE chunk_id = ? AND status = 'applied'`).run(oldId);
          this.db.prepare('DELETE FROM chunk_search WHERE chunk_id = ?').run(oldId);
          this.db.prepare('DELETE FROM edge_evidence WHERE chunk_id = ?').run(oldId);
          this.db.prepare('DELETE FROM node_evidence WHERE chunk_id = ?').run(oldId);
          this.db.prepare('UPDATE chunks SET active = 0 WHERE id = ?').run(oldId);
        }
        this.db.exec(`DELETE FROM edges WHERE origin = 'extracted'
          AND NOT EXISTS (SELECT 1 FROM edge_evidence WHERE edge_evidence.edge_id = edges.id)`);
        this.db.exec(`DELETE FROM nodes WHERE origin = 'extracted'
          AND NOT EXISTS (SELECT 1 FROM node_evidence WHERE node_evidence.node_id = nodes.id)
          AND NOT EXISTS (SELECT 1 FROM edges WHERE edges.from_id = nodes.id OR edges.to_id = nodes.id)`);
        this.db.prepare(`UPDATE documents SET path = ?, kind = ?, authored_at = ?, url = ?, sha256 = ?, updated_at = ?
          WHERE id = ?`).run(source.path, source.kind, source.authoredAt ?? chunks[0]?.authoredAt ?? null,
          source.url ?? null, contentHash, now(), source.id);
      } else {
        this.db.prepare(`INSERT INTO documents(id, path, kind, authored_at, url, sha256, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(source.id, source.path, source.kind,
          source.authoredAt ?? chunks[0]?.authoredAt ?? null, source.url ?? null, contentHash, now());
      }
      for (const chunk of chunks) {
        const prior = this.db.prepare('SELECT active FROM chunks WHERE id = ?').get(chunk.id) as Row | undefined;
        if (prior) {
          this.db.prepare(`UPDATE chunks SET heading = ?, context_json = ?, start_line = ?, end_line = ?, authored_at = ?, active = 1
            WHERE id = ?`).run(chunk.heading, JSON.stringify(chunk.context), chunk.startLine, chunk.endLine, chunk.authoredAt, chunk.id);
          if (!prior.active) {
            this.db.prepare('INSERT INTO chunk_search(chunk_id, text) VALUES (?, ?)').run(chunk.id, chunk.text);
            toExtract.push(chunk);
          }
        } else {
          this.db.prepare(`INSERT INTO chunks(id, document_id, heading, context_json, start_line, end_line, text, authored_at, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(chunk.id, chunk.documentId, chunk.heading,
            JSON.stringify(chunk.context), chunk.startLine, chunk.endLine, chunk.text, chunk.authoredAt);
          this.db.prepare('INSERT INTO chunk_search(chunk_id, text) VALUES (?, ?)').run(chunk.id, chunk.text);
          toExtract.push(chunk);
        }
      }
      return { changed: true, chunks, toExtract };
    });
  }

  /** Active chunks, optionally limited to one source kind and to sources authored on or before a date. */
  listChunks(filter: { kind?: SourceDocument['kind']; until?: string } = {}): SourceChunk[] {
    const rows = this.db.prepare(`SELECT c.*, d.path, d.kind FROM chunks c JOIN documents d ON d.id = c.document_id
      WHERE c.active = 1 AND (? IS NULL OR d.kind = ?) AND (? IS NULL OR c.authored_at <= ?)
      ORDER BY c.authored_at, d.path, c.start_line`).all(
      filter.kind ?? null, filter.kind ?? null, filter.until ?? null, filter.until ?? null) as Row[];
    return rows.map(mapChunk);
  }

  listDocuments(filter: { kind?: SourceDocument['kind'] } = {}): { id: string; path: string; kind: SourceDocument['kind']; authoredAt: string | null }[] {
    const rows = this.db.prepare(`SELECT id, path, kind, authored_at FROM documents WHERE (? IS NULL OR kind = ?)
      ORDER BY authored_at, path`).all(filter.kind ?? null, filter.kind ?? null) as Row[];
    return rows.map((row) => ({ id: string(row.id), path: string(row.path), kind: row.kind as SourceDocument['kind'],
      authoredAt: row.authored_at == null ? null : string(row.authored_at) }));
  }

  searchChunks(query: string, limit = 20): SearchHit[] {
    const tokens = query.match(/[\p{L}\p{N}]+/gu)?.slice(0, 12) ?? [];
    if (!tokens.length) return [];
    const expression = tokens.map((token) => `"${token.replaceAll('"', '')}"`).join(' OR ');
    const rows = this.db.prepare(`SELECT c.*, d.path, d.kind, bm25(chunk_search) AS rank
      FROM chunk_search JOIN chunks c ON c.id = chunk_search.chunk_id
      JOIN documents d ON d.id = c.document_id
      WHERE chunk_search MATCH ? AND c.active = 1 ORDER BY rank LIMIT ?`).all(expression, limit) as Row[];
    return rows.map((row) => ({ chunk: mapChunk(row), rank: Number(row.rank) }));
  }

  searchNodes(query: string, limit = 20): GraphNode[] {
    const normalized = normalizeName(query);
    const words = normalized.split(' ').filter((word) => word.length > 2);
    if (!words.length) return [];
    const rows = this.db.prepare('SELECT * FROM nodes').all() as Row[];
    return rows.map(mapNode).map((node) => {
      const names = [node.label, ...node.aliases].map(normalizeName);
      let score = 0;
      for (const name of names) {
        if (name && normalized.includes(name)) score = Math.max(score, 100 + name.length);
        else score = Math.max(score, words.filter((word) => name.includes(word)).length * 10);
      }
      return { node, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.node);
  }

  private candidateNodes(text: string): GraphNode[] {
    const matches = this.searchNodes(text, 20);
    const decisions = (this.db.prepare("SELECT * FROM nodes WHERE kind = 'decision' LIMIT 5").all() as Row[]).map(mapNode);
    return [...new Map([...matches, ...decisions].map((node) => [node.id, node])).values()].slice(0, 25);
  }

  private edgeId(from: string, relation: Relation, to: string): string {
    return `edge:${hash(`${from}|${relation}|${to}`).slice(0, 24)}`;
  }

  private newNodeId(chunkId: string, node: PatchNode): string {
    if (['person', 'organization', 'product', 'project', 'customer_segment'].includes(node.kind)) {
      return nodeKey(node.kind, node.label);
    }
    return `${node.kind}:${hash(`${chunkId}|${node.tempId}|${node.label}`).slice(0, 24)}`;
  }

  private validatePatch(patch: GraphPatch, chunk: SourceChunk, readSet: IngestionProposal['readSet']): ProposalDiff {
    if (!patch || !Array.isArray(patch.newNodes) || !Array.isArray(patch.edges) ||
      !Array.isArray(patch.nodeEvidence) || !Array.isArray(patch.aliasUpdates)) {
      throw new Error('Extractor must return newNodes, edges, nodeEvidence, and aliasUpdates arrays');
    }
    if (patch.newNodes.length > 40 || patch.edges.length > 100 ||
      patch.nodeEvidence.length > 100 || patch.aliasUpdates.length > 40) {
      throw new Error('Graph patch exceeds the per-item limit');
    }
    const allowedExisting = new Map(readSet.map((item) => [item.id, this.getNode(item.id)]));
    const temporary = new Map<string, { kind: NodeKind; id: string }>();
    const allNodes = (this.db.prepare('SELECT * FROM nodes').all() as Row[]).map(mapNode);
    for (const node of patch.newNodes) {
      if (typeof node.tempId !== 'string' || !/^[a-zA-Z][\w-]{0,63}$/.test(node.tempId) || temporary.has(node.tempId)) {
        throw new Error('New nodes need distinct temporary IDs');
      }
      if (!isNodeKind(node.kind) || typeof node.label !== 'string' || !node.label.trim() || node.label.length > 300) {
        throw new Error(`Invalid new node ${node.tempId}`);
      }
      if (!Array.isArray(node.aliases) || node.aliases.some((alias) => typeof alias !== 'string' || alias.length > 150)) {
        throw new Error(`Invalid aliases for ${node.tempId}`);
      }
      if (!Array.isArray(node.attributes) || node.attributes.some((attribute) =>
        !attribute || typeof attribute.key !== 'string' || typeof attribute.value !== 'string' ||
        attribute.key.length > 80 || attribute.value.length > 1000)) {
        throw new Error(`Invalid attributes for ${node.tempId}`);
      }
      if (node.kind === 'decision' && node.attributes.some((attribute) =>
        attribute.key === 'status' && ['approved', 'decided', 'completed'].includes(attribute.value.toLowerCase()))) {
        throw new Error('Imported content cannot approve a decision; record the choice through the application');
      }
      const id = this.newNodeId(chunk.id, node);
      if (this.getNode(id)) throw new Error(`Node ${id} already exists; use its ID instead`);
      if (['person', 'organization', 'product', 'project', 'customer_segment'].includes(node.kind)) {
        const aliases = [node.label, ...node.aliases].map(normalizeName);
        if (allNodes.some((existing) => existing.kind === node.kind &&
          [existing.label, ...existing.aliases].some((name) => aliases.includes(normalizeName(name))))) {
          throw new Error(`Potential duplicate ${node.kind}: ${node.label}`);
        }
      }
      temporary.set(node.tempId, { kind: node.kind, id });
    }
    for (const node of patch.newNodes) {
      for (const attribute of node.attributes) {
        if (attribute.key.endsWith('_id') && attribute.value &&
          !temporary.has(attribute.value) && !allowedExisting.has(attribute.value)) {
          throw new Error(`Unknown entity reference in ${attribute.key}: ${attribute.value}`);
        }
      }
    }
    const kindOf = (ref: string): NodeKind => {
      if (temporary.has(ref)) return temporary.get(ref)!.kind;
      const existing = allowedExisting.get(ref);
      if (!existing) throw new Error(`Unknown or unread node reference: ${ref}`);
      return existing.kind;
    };
    const resolve = (ref: string): string => temporary.get(ref)?.id ?? ref;
    const nodeEvidenceRefs = new Set<string>();
    for (const evidence of patch.nodeEvidence) {
      if (!evidence || typeof evidence.nodeRef !== 'string' || typeof evidence.quote !== 'string' ||
        !['supports', 'opposes', 'mentions', 'inferred'].includes(evidence.role) || !chunk.text.includes(evidence.quote) || !evidence.quote.trim()) {
        throw new Error('Node evidence must contain an exact nonempty quote from its source chunk');
      }
      kindOf(evidence.nodeRef);
      nodeEvidenceRefs.add(evidence.nodeRef);
    }
    for (const node of patch.newNodes) {
      if (!nodeEvidenceRefs.has(node.tempId)) throw new Error(`New node ${node.tempId} lacks source evidence`);
    }
    const aliases: ProposalDiff['aliases'] = [];
    for (const update of patch.aliasUpdates) {
      const node = allowedExisting.get(update?.nodeId);
      if (!node || typeof update.alias !== 'string' || !update.alias.trim() || update.alias.length > 150 ||
        typeof update.quote !== 'string' || !chunk.text.includes(update.quote) ||
        !normalizeName(update.quote).includes(normalizeName(update.alias))) {
        throw new Error('Alias update needs an existing read node and a source quote containing that alias');
      }
      if (allNodes.some((other) => other.id !== node.id && other.kind === node.kind &&
        [other.label, ...other.aliases].some((name) => normalizeName(name) === normalizeName(update.alias)))) {
        throw new Error(`Alias already belongs to another ${node.kind}: ${update.alias}`);
      }
      if (!node.aliases.some((alias) => normalizeName(alias) === normalizeName(update.alias)) &&
        normalizeName(node.label) !== normalizeName(update.alias)) {
        aliases.push({ nodeId: node.id, before: node.aliases, after: [...node.aliases, update.alias] });
      }
    }
    const edgeDiff: ProposalDiff['edges'] = [];
    const seenEdges = new Set<string>();
    for (const edge of patch.edges) {
      if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string' || !isRelation(edge.relation) ||
        !['explicit', 'inferred'].includes(edge.basis) || typeof edge.quote !== 'string' ||
        !edge.quote.trim() || !chunk.text.includes(edge.quote)) {
        throw new Error('Edge needs a valid relation, basis, and exact source quote');
      }
      const fromKind = kindOf(edge.from);
      const toKind = kindOf(edge.to);
      if (!allowsRelation(edge.relation, fromKind, toKind)) {
        throw new Error(`Invalid relation signature: ${fromKind} ${edge.relation} ${toKind}`);
      }
      const from = resolve(edge.from);
      const to = resolve(edge.to);
      const id = this.edgeId(from, edge.relation, to);
      if (seenEdges.has(id)) throw new Error(`Duplicate edge in patch: ${id}`);
      seenEdges.add(id);
      const existingEdge = this.getEdge(id);
      edgeDiff.push({ operation: existingEdge ? 'reuse' : 'create', from, relation: edge.relation, to,
        before: existingEdge ? { id: existingEdge.id } : null, after: { id } });
    }
    return {
      nodes: patch.newNodes.map((node) => ({ operation: 'create', tempId: node.tempId,
        id: this.newNodeId(chunk.id, node), before: null,
        after: { kind: node.kind, label: node.label, aliases: node.aliases,
          attributes: Object.fromEntries(node.attributes.map((attribute) => [attribute.key, attribute.value])) } })),
      edges: edgeDiff,
      aliases,
    };
  }

  async proposeChunk(chunkId: string, extractor: GraphExtractor): Promise<IngestionProposal> {
    const chunk = this.getChunk(chunkId);
    if (!chunk || !chunk.active) throw new Error(`Active chunk not found: ${chunkId}`);
    const prior = this.db.prepare(`SELECT * FROM ingestion_runs WHERE chunk_id = ? AND status IN ('pending', 'applied')
      ORDER BY created_at DESC LIMIT 1`).get(chunkId) as Row | undefined;
    if (prior) return mapProposal(prior);
    const existingNodes = this.candidateNodes(`${chunk.heading}\n${chunk.context.participants.join(', ')}\n${chunk.text}`);
    const ids = new Set(existingNodes.map((node) => node.id));
    const existingEdges = (this.db.prepare('SELECT * FROM edges').all() as Row[]).map(mapEdge)
      .filter((edge) => ids.has(edge.from) || ids.has(edge.to)).slice(0, 50);
    const input: ExtractionInput = { chunk, existingNodes, existingEdges };
    const patch = await extractor.extract(input);
    const readSet = existingNodes.map((node) => ({ id: node.id, version: node.version }));
    const diff = this.validatePatch(patch, chunk, readSet);
    const id = `run:${randomUUID()}`;
    this.db.prepare(`INSERT INTO ingestion_runs(id, chunk_id, source_hash, read_set_json, patch_json,
      diff_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run(
      id, chunk.id, hash(chunk.text), JSON.stringify(readSet), JSON.stringify(patch), JSON.stringify(diff), now(),
    );
    return this.getProposal(id)!;
  }

  rejectProposal(id: string): IngestionProposal {
    const proposal = this.getProposal(id);
    if (!proposal || proposal.status !== 'pending') throw new Error(`Pending proposal not found: ${id}`);
    this.db.prepare("UPDATE ingestion_runs SET status = 'rejected' WHERE id = ?").run(id);
    return this.getProposal(id)!;
  }

  applyProposal(id: string): IngestionProposal {
    const result = this.transaction(() => {
      const proposal = this.getProposal(id);
      if (!proposal || proposal.status !== 'pending') throw new Error(`Pending proposal not found: ${id}`);
      const chunk = this.getChunk(proposal.chunkId);
      const expectedHash = this.db.prepare('SELECT source_hash FROM ingestion_runs WHERE id = ?').get(id) as Row;
      const stale = !chunk || !chunk.active || hash(chunk.text) !== expectedHash.source_hash ||
        proposal.readSet.some((item) => this.getNode(item.id)?.version !== item.version);
      if (stale) {
        this.db.prepare("UPDATE ingestion_runs SET status = 'stale' WHERE id = ?").run(id);
        return this.getProposal(id)!;
      }
      let diff: ProposalDiff;
      try { diff = this.validatePatch(proposal.patch, chunk, proposal.readSet); }
      catch {
        this.db.prepare("UPDATE ingestion_runs SET status = 'stale' WHERE id = ?").run(id);
        return this.getProposal(id)!;
      }
      const tempIds = new Map(diff.nodes.map((node) => [node.tempId, node.id]));
      const resolve = (ref: string) => tempIds.get(ref) ?? ref;
      const affectedExisting = new Set<string>();
      for (const node of proposal.patch.newNodes) {
        const attributes = Object.fromEntries(node.attributes.map((attribute) => [attribute.key, attribute.value]));
        this.db.prepare(`INSERT INTO nodes(id, kind, label, aliases_json, attributes_json, review_status, origin)
          VALUES (?, ?, ?, ?, ?, 'unreviewed', 'extracted')`).run(
          resolve(node.tempId), node.kind, node.label, JSON.stringify(node.aliases), JSON.stringify(attributes),
        );
      }
      for (const evidence of proposal.patch.nodeEvidence) {
        const nodeId = resolve(evidence.nodeRef);
        this.db.prepare(`INSERT OR IGNORE INTO node_evidence(node_id, chunk_id, quote, role)
          VALUES (?, ?, ?, ?)`).run(nodeId, chunk.id, evidence.quote, evidence.role);
      }
      for (const update of proposal.patch.aliasUpdates) {
        const node = this.getNode(update.nodeId)!;
        if (!node.aliases.some((alias) => normalizeName(alias) === normalizeName(update.alias)) &&
          normalizeName(node.label) !== normalizeName(update.alias)) {
          this.db.prepare('UPDATE nodes SET aliases_json = ? WHERE id = ?')
            .run(JSON.stringify([...node.aliases, update.alias]), node.id);
        }
        this.db.prepare(`INSERT OR IGNORE INTO node_evidence(node_id, chunk_id, quote, role)
          VALUES (?, ?, ?, 'mentions')`).run(node.id, chunk.id, update.quote);
        affectedExisting.add(node.id);
      }
      for (const edge of proposal.patch.edges) {
        const from = resolve(edge.from);
        const to = resolve(edge.to);
        const edgeId = this.edgeId(from, edge.relation, to);
        const wasPresent = Boolean(this.getEdge(edgeId));
        this.db.prepare(`INSERT OR IGNORE INTO edges(id, from_id, relation, to_id, origin)
          VALUES (?, ?, ?, ?, 'extracted')`).run(edgeId, from, edge.relation, to);
        this.db.prepare(`INSERT OR IGNORE INTO edge_evidence(edge_id, chunk_id, quote, role)
          VALUES (?, ?, ?, ?)`).run(edgeId, chunk.id, edge.quote, edge.basis === 'inferred' ? 'inferred' : 'supports');
        if (wasPresent) this.db.prepare('UPDATE edges SET version = version + 1 WHERE id = ?').run(edgeId);
      }
      for (const nodeId of affectedExisting) {
        this.db.prepare('UPDATE nodes SET version = version + 1 WHERE id = ?').run(nodeId);
      }
      this.db.prepare(`UPDATE ingestion_runs SET status = 'applied', applied_at = ?, diff_json = ? WHERE id = ?`)
        .run(now(), JSON.stringify(diff), id);
      return this.getProposal(id)!;
    });
    return result;
  }

  async ingestDocument(source: SourceDocument, extractor: GraphExtractor, apply = false): Promise<IngestionProposal[]> {
    const indexed = this.indexDocument(source);
    const proposals: IngestionProposal[] = [];
    for (const chunk of indexed.toExtract) {
      const proposal = await this.proposeChunk(chunk.id, extractor);
      proposals.push(apply ? this.applyProposal(proposal.id) : proposal);
    }
    return proposals;
  }

  getNodeEvidence(id: string): EvidenceItem[] {
    const rows = this.db.prepare(`SELECT ne.node_id, ne.quote, ne.role, c.*, d.path, d.kind
      FROM node_evidence ne JOIN chunks c ON c.id = ne.chunk_id
      JOIN documents d ON d.id = c.document_id
      WHERE ne.node_id = ? AND c.active = 1 ORDER BY c.authored_at DESC`).all(id) as Row[];
    return rows.map((row) => evidenceItem(row, { nodeId: id }));
  }

  getEdgeEvidence(id: string): EvidenceItem[] {
    const rows = this.db.prepare(`SELECT ee.edge_id, ee.quote, ee.role, c.*, d.path, d.kind
      FROM edge_evidence ee JOIN chunks c ON c.id = ee.chunk_id
      JOIN documents d ON d.id = c.document_id
      WHERE ee.edge_id = ? AND c.active = 1 ORDER BY c.authored_at DESC`).all(id) as Row[];
    return rows.map((row) => evidenceItem(row, { edgeId: id }));
  }

  getGraphSnapshot(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: (this.db.prepare('SELECT * FROM nodes ORDER BY kind, label').all() as Row[]).map(mapNode),
      edges: (this.db.prepare('SELECT * FROM edges ORDER BY relation').all() as Row[]).map(mapEdge),
    };
  }

  buildDecisionContext(question: string, maxEvidence = 30): DecisionContext {
    const hits = this.searchChunks(question, 12);
    const anchors = this.searchNodes(question, 8);
    const snapshot = this.getGraphSnapshot();
    const chosen = new Set(anchors.map((node) => node.id));
    const hitIds = new Set(hits.map((hit) => hit.chunk.id));
    if (hitIds.size) {
      for (const row of this.db.prepare(`SELECT ne.node_id, ne.chunk_id FROM node_evidence ne
        JOIN chunks c ON c.id = ne.chunk_id WHERE c.active = 1`).all() as Row[]) {
        if (hitIds.has(string(row.chunk_id))) chosen.add(string(row.node_id));
      }
      for (const row of this.db.prepare(`SELECT e.from_id, e.to_id, ee.chunk_id FROM edge_evidence ee
        JOIN edges e ON e.id = ee.edge_id JOIN chunks c ON c.id = ee.chunk_id WHERE c.active = 1`).all() as Row[]) {
        if (hitIds.has(string(row.chunk_id))) { chosen.add(string(row.from_id)); chosen.add(string(row.to_id)); }
      }
    }
    let frontier = new Set(chosen);
    for (let depth = 0; depth < 2; depth++) {
      const next = new Set<string>();
      for (const edge of snapshot.edges) {
        if (frontier.has(edge.from)) next.add(edge.to);
        if (frontier.has(edge.to)) next.add(edge.from);
      }
      for (const id of next) chosen.add(id);
      frontier = next;
    }
    const nodes = snapshot.nodes.filter((node) => chosen.has(node.id));
    const edges = snapshot.edges.filter((edge) => chosen.has(edge.from) && chosen.has(edge.to));
    const items = [
      ...nodes.flatMap((node) => this.getNodeEvidence(node.id)),
      ...edges.flatMap((edge) => this.getEdgeEvidence(edge.id)),
    ];
    const seen = new Set<string>();
    const evidence = items.filter((item) => {
      const key = `${item.chunk.id}|${item.quote}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      const aDirect = hitIds.has(a.chunk.id) ? 1 : 0;
      const bDirect = hitIds.has(b.chunk.id) ? 1 : 0;
      return bDirect - aDirect || string(b.chunk.authoredAt).localeCompare(string(a.chunk.authoredAt));
    }).slice(0, maxEvidence);
    return { question, anchors, nodes, edges, evidence,
      searchedSources: new Set(hits.map((hit) => hit.chunk.documentId)).size };
  }
}
