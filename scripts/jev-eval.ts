import { SCENARIOS } from '../src/demo/knowledge.ts'
import { detectRelevance } from '../src/server/relevance.ts'

/**
 * Replays every scripted meeting line through the live Jev router and prints
 * what it would do against the scenario's expectation.
 *
 *   node --env-file=.env scripts/jev-eval.ts
 */

const meetingFor = (title: string, goal: string) => ({ title, goal, participants: [] as string[] })

let pass = 0
let total = 0
const latencies: number[] = []

for (const scenario of SCENARIOS) {
  console.log(`\n== ${scenario.title}`)
  const recent: { speaker: string; text: string }[] = []
  for (const line of scenario.lines) {
    recent.push({ speaker: line.speakerId, text: line.text })
    const r = await detectRelevance({ meeting: meetingFor(scenario.title, scenario.goal), recent: recent.slice(-6) })
    const shown = r.action === 'show' ? r.topic.id : null
    const expected = line.expect?.card ?? null
    const ok = shown === expected
    const facetOk = !line.expect?.facet || line.expect.facet === r.facet.id
    total++
    if (ok) pass++
    latencies.push(r.latencyMs)
    const flag = ok ? (facetOk ? ' ok ' : ' ~f ') : ' XX '
    console.log(
      `${flag} ${r.engine}${r.via ? `/${r.via}` : ''} ${String(r.latencyMs).padStart(4)}ms  info=${r.needsInfo.toFixed(2)} topic=${(r.topic.id ?? 'none').padEnd(14)} conf=${r.topic.confidence.toFixed(2)} facet=${r.facet.id.padEnd(8)} → ${r.action.padEnd(7)} | want ${expected ?? 'none'}${line.expect?.facet ? `/${line.expect.facet}` : ''}${r.error ? `  ERR ${r.error}` : ''}`,
    )
    console.log(`      "${line.text}"`)
  }
}

latencies.sort((a, b) => a - b)
const p50 = latencies[Math.floor(latencies.length / 2)] ?? 0
console.log(`\ncards ${pass}/${total} correct · latency p50 ${p50} ms, max ${latencies.at(-1) ?? 0} ms`)
