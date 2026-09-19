import { NODE_KINDS, RELATIONS, type NodeKind, type Relation } from './types.ts';

const ENTITY_KINDS: readonly NodeKind[] = ['person', 'organization', 'product', 'project', 'customer_segment'];
const scopes: Record<Relation, { from: readonly NodeKind[]; to: readonly NodeKind[] }> = {
  about: { from: ['claim', 'decision', 'option', 'action'], to: ENTITY_KINDS },
  informs: { from: ['claim'], to: ['decision'] },
  considers: { from: ['decision'], to: ['option'] },
  relies_on: { from: ['decision', 'option'], to: ['claim'] },
  targets: { from: ['decision'], to: ['metric'] },
  measures: { from: ['observation'], to: ['metric', 'decision'] },
  assigned_to: { from: ['action', 'decision'], to: ['person'] },
  in_tension_with: { from: ['claim'], to: ['claim'] },
  contradicts: { from: ['claim'], to: ['claim'] },
  supersedes: { from: ['claim', 'observation'], to: ['claim', 'observation'] },
  works_on: { from: ['person'], to: ['product', 'project'] },
};

export function isNodeKind(value: unknown): value is NodeKind {
  return typeof value === 'string' && (NODE_KINDS as readonly string[]).includes(value);
}

export function isRelation(value: unknown): value is Relation {
  return typeof value === 'string' && (RELATIONS as readonly string[]).includes(value);
}

export function allowsRelation(relation: Relation, from: NodeKind, to: NodeKind): boolean {
  const scope = scopes[relation];
  return scope.from.includes(from) && scope.to.includes(to);
}

export function normalizeName(value: string): string {
  return value.replaceAll('ł', 'l').replaceAll('Ł', 'L').normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function nodeKey(kind: NodeKind, label: string): string {
  const slug = normalizeName(label).replaceAll(' ', '-');
  if (!slug) throw new Error('Node label has no usable identifier');
  return `${kind}:${slug}`;
}
