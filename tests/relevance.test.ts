import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SCENARIOS } from '../src/demo/knowledge.ts'
import { fallback } from '../src/server/relevance.ts'

const meeting = { title: 'test', goal: '', participants: [] }

test('offline fallback surfaces the expected card for every scripted line', () => {
  for (const scenario of SCENARIOS) {
    const recent: { speaker: string; text: string }[] = []
    for (const line of scenario.lines) {
      recent.push({ speaker: line.speakerId, text: line.text })
      const result = fallback({ meeting, recent: recent.slice(-6) }, 0)
      const shown = result.action === 'show' ? result.topic.id : null
      assert.equal(shown, line.expect?.card ?? null, `${scenario.id}/${line.id}: "${line.text}" → ${shown} (${result.facet.id})`)
      if (line.expect?.facet) assert.equal(result.facet.id, line.expect.facet, `${scenario.id}/${line.id} facet`)
    }
  }
})
