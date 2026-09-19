import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SourceDocument } from '../graph/types.ts';

const defaultRoot = fileURLToPath(new URL('../../knowledge/synthetic/', import.meta.url));
const sourceGroups = [
  { directory: 'slack', kind: 'slack' },
  { directory: 'emails', kind: 'email' },
  { directory: 'meetings', kind: 'meeting_note' },
  { directory: 'notes', kind: 'note' },
  { directory: 'tickets', kind: 'support_ticket' },
] as const;

export interface SyntheticCorpusOptions {
  /** Defaults to the checked-in knowledge/synthetic directory. */
  root?: string;
  /** Inclusive YYYY-MM-DD cutoff; prevents later documents leaking into earlier demos. */
  asOf?: string;
}

function validateDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`Invalid date for ${label}: ${value}`);
  }
}

function readFrontmatter(content: string, path: string): { id: string; date: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`Missing frontmatter in ${path}`);
  const field = (key: string): string | undefined => match[1]?.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  const id = field('id');
  const date = field('date');
  if (!id || !date) throw new Error(`Missing id or date in ${path}`);
  validateDate(date, path);
  return { id, date };
}

export async function loadSyntheticDocuments(
  options: SyntheticCorpusOptions = {},
): Promise<SourceDocument[]> {
  const root = options.root ?? defaultRoot;
  if (options.asOf) validateDate(options.asOf, 'asOf');
  const sources: SourceDocument[] = [];
  const seenIds = new Set<string>();

  const add = async (relativePath: string, kind: SourceDocument['kind']) => {
    const content = await readFile(join(root, relativePath), 'utf8');
    const { id, date } = readFrontmatter(content, relativePath);
    if (seenIds.has(id)) throw new Error(`Duplicate synthetic source id: ${id}`);
    seenIds.add(id);
    if (options.asOf && date > options.asOf) return;
    sources.push({
      id,
      path: `knowledge/synthetic/${relativePath}`,
      kind,
      content,
      authoredAt: date,
    });
  };

  await add('external-signal.md', 'external');
  await add('company-profile.md', 'note');
  for (const { directory, kind } of sourceGroups) {
    const files = (await readdir(join(root, directory))).filter((name) => name.endsWith('.md')).sort();
    for (const file of files) await add(`${directory}/${file}`, kind);
  }
  return sources.sort((a, b) =>
    (a.authoredAt ?? '').localeCompare(b.authoredAt ?? '') || a.path.localeCompare(b.path));
}

export interface SyntheticKpiRow {
  observationId: string;
  date: string;
  decisionId: string;
  metric: string;
  period: string;
  value: number;
  target: number;
  unit: string;
  sourceNote: string;
}

export async function loadSyntheticKpis(
  options: SyntheticCorpusOptions = {},
): Promise<SyntheticKpiRow[]> {
  const root = options.root ?? defaultRoot;
  if (options.asOf) validateDate(options.asOf, 'asOf');
  const csv = await readFile(join(root, 'kpis/activations.csv'), 'utf8');
  const lines = csv.trim().split(/\r?\n/);
  const expectedHeader = 'observation_id,date,decision_id,metric,period,value,target,unit,source_note';
  if (lines.shift() !== expectedHeader) throw new Error('Unexpected synthetic KPI CSV header');
  return lines.map((line) => {
    const fields = line.split(',');
    if (fields.length !== 9) throw new Error(`Invalid synthetic KPI row: ${line}`);
    const [observationId, date, decisionId, metric, period, rawValue, rawTarget, unit, sourceNote] = fields;
    validateDate(date!, observationId!);
    const value = Number(rawValue);
    const target = Number(rawTarget);
    if (!Number.isFinite(value) || !Number.isFinite(target)) {
      throw new Error(`Invalid synthetic KPI value: ${observationId}`);
    }
    return { observationId: observationId!, date: date!, decisionId: decisionId!, metric: metric!,
      period: period!, value, target, unit: unit!, sourceNote: sourceNote! };
  }).filter((row) => !options.asOf || row.date <= options.asOf);
}
