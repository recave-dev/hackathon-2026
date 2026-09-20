import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SCENARIOS } from '../src/demo/knowledge.ts'
import { isDismissal, isExit, matchWake } from '../src/lib/wake-word.ts'
import { findContacts } from '../src/server/directory.ts'
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
  assert.equal(matchWake('Bolek, yyy').bare, true)
  assert.deepEqual(matchWake('Bolek, wyślij'), { addressed: true, command: 'wyślij', bare: false })
  assert.deepEqual(matchWake('Bolek, schowaj'), { addressed: true, command: 'schowaj', bare: false })
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

test('exit phrases leave the meeting, with or without the name', () => {
  for (const said of ['Spotkanie skończone.', 'Kończymy spotkanie', 'Wyjdź do menu', 'Bolek, kończymy spotkanie', 'Bolku, wyjdź do menu głównego', 'OK, koniec spotkania.', 'No dobra, spotkanie zakończone', 'Wróć do menu']) {
    const m = matchWake(said)
    assert.equal(isExit(m.addressed ? m.command : said), true, said)
  }
  for (const said of ['Kończymy.', 'OK, dzięki. Kończymy.', 'Jak kończymy spotkanie, wyślij notatkę', 'Spotkanie skończone o piątej?', 'Bolek, pokaż menu', 'Kto prowadzi spotkanie?']) {
    const m = matchWake(said)
    assert.equal(isExit(m.addressed ? m.command : said), false, said)
  }
})

test('offline fallback triages addressed requests', () => {
  const meeting = { title: 't', goal: '', participants: [] }
  const judge = (text: string, trayItems?: { id: string; title: string }[]) => fallback({ meeting, recent: [{ speaker: 'x', text }], mode: 'command', trayItems }, 0)
  assert.equal(judge('kim jest Darek Wylon?').intent.id, 'person')
  assert.equal(judge('schowaj to').intent.id, 'ui_close')
  assert.equal(judge('odłóż to na później').intent.id, 'ui_background')
  assert.equal(judge('wyślij').intent.id, 'ui_send')
  assert.equal(judge('przesuń w górę').intent.id, 'ui_scroll_up')
  assert.equal(judge('scroll do góry').intent.id, 'ui_scroll_up')
  assert.equal(judge('przewiń niżej').intent.id, 'ui_scroll_down')
  assert.equal(judge('ile zapłaciliśmy za Pipedrive w sierpniu?').intent.id, 'ask')
  assert.equal(judge('zrób punkty z ostatniego tematu').intent.id, 'ask')
  const r = judge('otwórz raport o wydatkach', [{ id: 'a', title: 'Notatka: Beta Testing' }, { id: 'b', title: 'Raport: Wydatki na narzędzia' }])
  assert.equal(r.intent.id, 'ui_open')
  assert.equal(r.openTarget?.id, 'b')
})

test('directory matches Polish name forms', () => {
  assert.equal(findContacts('wyślij maila do Tomasza Kielara')[0]?.email, 'k1eu@bielsko.ai')
  assert.equal(findContacts('napisz do Michała Staśkiewicza')[0]?.email, 'mikoscz@bielsko.ai')
  assert.equal(findContacts('do Michala')[0]?.email, 'mikoscz@bielsko.ai')
  assert.equal(findContacts('Kielarowi też')[0]?.email, 'k1eu@bielsko.ai')
  assert.equal(findContacts('do Anny Nowak').length, 0)
})
