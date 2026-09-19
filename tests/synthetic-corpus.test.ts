import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSyntheticDocuments, loadSyntheticKpis } from '../src/corpus/synthetic.ts';

test('synthetic corpus has distinct dated sources and no future leakage', async () => {
  const all = await loadSyntheticDocuments();
  assert.equal(all.length, 31); // 7 Slack, 10 emails, 10 meetings, 2 notes, profile, signal
  assert.equal(new Set(all.map((source) => source.id)).size, all.length);
  assert.deepEqual(all.reduce<Record<string, number>>((counts, source) => {
    counts[source.kind] = (counts[source.kind] ?? 0) + 1;
    return counts;
  }, {}), { external: 1, meeting_note: 10, note: 3, email: 10, slack: 7 });

  const beforeDecision = await loadSyntheticDocuments({ asOf: '2025-05-12' });
  assert(beforeDecision.some((source) => source.id === 'meeting-edoreczenia-decision-2025-05-12'));
  assert(!beforeDecision.some((source) => source.id === 'meeting-pilot-outcome-2025-11-12'));
  assert(!beforeDecision.some((source) => source.content.includes('six paid municipal activations as of 12 November')));
});

test('customer requests and outcome records preserve the demo evidence gap', async () => {
  const sources = await loadSyntheticDocuments({ asOf: '2025-05-12' });
  const requests = sources.filter((source) => source.kind === 'email' && source.id.includes('-request-'));
  assert.equal(requests.length, 4);
  const salesThread = sources.find((source) => source.id === 'slack-sales-demand-2025-05-02');
  assert.match(salesThread?.content ?? '', /12 municipalities interested/);
  assert.match(salesThread?.content ?? '', /not twelve orders/);

  const before = await loadSyntheticKpis({ asOf: '2025-05-12' });
  assert(before.some((row) => row.period === '6_month_target' && row.value === 10));
  assert(!before.some((row) => row.period === '6_month_actual'));
  const after = await loadSyntheticKpis({ asOf: '2025-11-12' });
  assert(after.some((row) => row.period === '6_month_actual' && row.value === 6 && row.target === 10));
});
