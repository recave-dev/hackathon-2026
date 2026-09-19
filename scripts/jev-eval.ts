import { SCENARIOS } from '../src/demo/knowledge.ts'
import { detectRelevance } from '../src/server/relevance.ts'
import { replayScenario } from './replay.ts'

/**
 * Replays every scripted meeting line through the live Jev router and prints
 * what it would do against the scenario's expectation.
 *
 *   node --env-file=.env scripts/jev-eval.ts
 */

let pass = 0
let total = 0
const latencies: number[] = []

for (const scenario of SCENARIOS) {
  console.log(`\n== ${scenario.title} (${scenario.mode})`)
  const steps = await replayScenario(scenario, detectRelevance)
  for (const { line, result: r, shown, expected } of steps) {
    total++
    const ok = shown === expected
    if (ok) pass++
    const facetOk = !line.expect?.facet || !r || line.expect.facet === r.facet.id
    const flag = ok ? (facetOk ? ' ok ' : ' ~f ') : ' XX '
    const want = `${expected ?? 'none'}${line.expect?.facet ? `/${line.expect.facet}` : ''}`
    if (!r) {
      console.log(`${flag} skipped (not addressed)${' '.repeat(62)} | want ${want}`)
    } else {
      latencies.push(r.latencyMs)
      console.log(
        `${flag} ${r.engine}${r.via ? `/${r.via}` : ''} ${r.mode.padEnd(7)} ${String(r.latencyMs).padStart(4)}ms info=${r.needsInfo.toFixed(2)} topic=${(r.topic.id ?? 'none').padEnd(14)} ${r.topic.confidence.toFixed(2)} person=${(r.person.id ?? 'none').padEnd(15)} ${r.person.confidence.toFixed(2)} ${r.facet.id.padEnd(8)} → ${r.action.padEnd(7)} | want ${want}${r.error ? `  ERR ${r.error}` : ''}`,
      )
    }
    console.log(`      "${line.text}"`)
  }
}

latencies.sort((a, b) => a - b)
const p50 = latencies[Math.floor(latencies.length / 2)] ?? 0
console.log(`\n${pass}/${total} correct · latency p50 ${p50} ms, max ${latencies.at(-1) ?? 0} ms`)
