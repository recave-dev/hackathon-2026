import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SCENARIOS } from '../src/demo/knowledge.ts'
import { isDismissal, matchWake } from '../src/lib/wake-word.ts'
import { fallback } from '../src/server/relevance.ts'
import { replayScenario } from '../scripts/replay.ts'

test('offline fallback surfaces the expected card or person for every scripted line', async () => {
  for (const scenario of SCENARIOS) {
    const steps = await replayScenario(scenario, async (input) => fallback(input, 0))
    for (const step of steps) {
      assert.equal(step.shown, step.expected, `${scenario.id}/${step.line.id}: "${step.line.text}" → ${step.shown}`)
      if (step.line.expect?.facet && step.result) assert.equal(step.result.facet.id, step.line.expect.facet, `${scenario.id}/${step.line.id} facet`)
    }
  }
})

test('wake word matching', () => {
  assert.deepEqual(matchWake('Bolek, powiedz mi, kim jest Darek Wylon?'), { addressed: true, command: 'kim jest Darek Wylon?', bare: false })
  assert.deepEqual(matchWake('Bolek.'), { addressed: true, command: '', bare: true })
  assert.deepEqual(matchWake('Bolku, kim jest Patrycja'), { addressed: true, command: 'kim jest Patrycja', bare: false })
  assert.equal(matchWake('A za co odpowiada Piotr, Bolek?').command, 'A za co odpowiada Piotr,')
  assert.equal(matchWake('Zero zmian poza jedną pozycją. Bolek, ile płacimy za Pipedrive?').command, 'ile płacimy za Pipedrive?')
  assert.equal(matchWake('Zero zmian w budżecie.').addressed, false)
  assert.equal(matchWake('Mamy zero aktywacji.').addressed, false)
  assert.equal(matchWake('Przejdźmy do Alfy.').addressed, false)
})

test('dismissal phrases', () => {
  for (const said of ['Bolek, dzięki', 'Bolku dzieki', 'Bolek, dziękuję.', 'Bolek, ok, wystarczy', 'Bolek, schowaj to']) {
    const m = matchWake(said)
    assert.equal(m.addressed, true, said)
    assert.equal(isDismissal(m.command), true, said)
  }
  assert.equal(isDismissal(matchWake('Bolek, kim jest Darek Wylon?').command), false)
  assert.equal(isDismissal(matchWake('Bolek, ile płacimy za Pipedrive?').command), false)
})
