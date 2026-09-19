import type { Scenario, ScenarioLine } from '../src/demo/knowledge.ts'
import { matchWake } from '../src/lib/wake-word.ts'
import type { RelevanceInput, RelevanceResult } from '../src/server/relevance.ts'

/**
 * Drives a scripted meeting the way the screen does: wake-word detection,
 * arming on a bare "Bolek", command vs ambient judging. Shared by the offline
 * test and the live Jev eval.
 */

export interface ReplayStep {
  line: ScenarioLine
  result: RelevanceResult | null
  shown: string | null
  expected: string | null
}

export const shownOf = (r: RelevanceResult | null): string | null => {
  if (!r || r.action !== 'show') return null
  return r.target === 'person' ? r.person.id : r.topic.id
}

export async function replayScenario(scenario: Scenario, judge: (input: RelevanceInput) => Promise<RelevanceResult>): Promise<ReplayStep[]> {
  const meeting = { title: scenario.title, goal: scenario.goal, participants: [] as string[] }
  const recent: { speaker: string; text: string }[] = []
  const steps: ReplayStep[] = []
  let armed = false
  for (const line of scenario.lines) {
    const expected = line.expect?.person ?? line.expect?.card ?? null
    const wake = matchWake(line.text)
    const addressed = wake.addressed || armed
    let result: RelevanceResult | null = null
    if (wake.addressed && wake.bare) {
      armed = true
    } else {
      armed = false
      if (scenario.mode === 'ambient' || addressed) {
        const latest = wake.addressed ? wake.command || line.text : line.text
        result = await judge({ meeting, recent: [...recent.slice(-5), { speaker: line.speakerId, text: latest }], mode: addressed ? 'command' : 'ambient' })
      }
    }
    recent.push({ speaker: line.speakerId, text: line.text })
    steps.push({ line, result, shown: shownOf(result), expected })
  }
  return steps
}
