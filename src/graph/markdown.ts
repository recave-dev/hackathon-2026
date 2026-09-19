import { createHash } from 'node:crypto';
import type { SourceChunk, SourceDocument } from './types.ts';

export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function splitDocument(source: SourceDocument): SourceChunk[] {
  const lines = source.content.replaceAll('\r\n', '\n').split('\n');
  let first = 0;
  let authoredAt = source.authoredAt ?? null;
  let topic = '';
  let participants: string[] = [];
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (end > 0) {
      const date = lines.slice(1, end).find((line) => /^date:\s*/i.test(line));
      const topicLine = lines.slice(1, end).find((line) => /^topic:\s*/i.test(line));
      const participantsLine = lines.slice(1, end).find((line) => /^participants:\s*/i.test(line));
      authoredAt ??= date?.replace(/^date:\s*/i, '').trim() || null;
      topic = topicLine?.replace(/^topic:\s*/i, '').trim() || '';
      if (participantsLine) {
        participants = participantsLine.replace(/^participants:\s*/i, '').trim()
          .replace(/^\[/, '').replace(/\]$/, '').split(',').map((part) => part.trim()).filter(Boolean);
      }
      first = end + 1;
    }
  }

  const sections: { heading: string; start: number; end: number }[] = [];
  let heading = 'Document';
  let start = first;
  for (let index = first; index < lines.length; index++) {
    const match = lines[index]?.match(/^#{1,6}\s+(.+)$/);
    if (!match) continue;
    if (index > start && lines.slice(start, index).some((line) => line.trim())) {
      sections.push({ heading, start, end: index - 1 });
    }
    heading = match[1]!.trim();
    start = index;
  }
  if (lines.slice(start).some((line) => line.trim())) {
    sections.push({ heading, start, end: lines.length - 1 });
  }

  return sections.map((section, index) => {
    const text = lines.slice(section.start, section.end + 1).join('\n').trim();
    const id = `chunk:${hash(`${source.id}:${index}:${text}`).slice(0, 24)}`;
    return {
      id, documentId: source.id, path: source.path, kind: source.kind,
      heading: topic ? `${topic} / ${section.heading}` : section.heading,
      context: { topic, participants },
      startLine: section.start + 1, endLine: section.end + 1,
      text, authoredAt, active: true,
    };
  });
}
