import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SCENARIOS } from '../src/demo/knowledge.ts'
import { isDismissal, isExit, matchWake } from '../src/lib/wake-word.ts'
import { findContacts } from '../src/server/directory.ts'
import { graphCatalog } from '../src/server/graph-cards.ts'
import { fallback } from '../src/server/relevance.ts'
import { replayScenario } from '../scripts/replay.ts'

const catalog = graphCatalog()

test('offline fallback resolves every scripted line to the expected graph entity', async () => {
  for (const scenario of SCENARIOS) {
    const steps = await replayScenario(scenario, async (input) => fallback(input, 0, catalog))
    for (const step of steps) {
      assert.equal(step.shown, step.expected, `${scenario.id}/${step.line.id}: "${step.line.text}" → ${step.shown}`)
      if (step.line.expect?.facet && step.result) assert.equal(step.result.facet.id, step.line.expect.facet, `${scenario.id}/${step.line.id} facet`)
    }
  }
})

test('catalog comes from the graph, not from demo lists', () => {
  assert.ok(catalog.topics.some((t) => t.id === 'product:pipedrive'))
  assert.ok(catalog.people.some((p) => p.id === 'person:karol-bak'))
  assert.equal(catalog.company, 'Aster Systems')
  assert.ok(!catalog.topics.some((t) => t.id === 'organization:aster-systems'), 'the company itself is not a topic')
})

test('wake word matching', () => {
  assert.deepEqual(matchWake('Bolek, powiedz mi, kim jest Karol Bąk?'), { addressed: true, command: 'kim jest Karol Bąk?', bare: false })
  assert.deepEqual(matchWake('Bolek.'), { addressed: true, command: '', bare: true })
  assert.equal(matchWake('Bolek, yyy').bare, true)
  assert.deepEqual(matchWake('Bolek, wyślij'), { addressed: true, command: 'wyślij', bare: false })
  assert.deepEqual(matchWake('Bolek, schowaj'), { addressed: true, command: 'schowaj', bare: false })
  assert.deepEqual(matchWake('Bolku, kim jest Ewa'), { addressed: true, command: 'kim jest Ewa', bare: false })
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
  assert.equal(isDismissal(matchWake('Bolek, kim jest Karol Bąk?').command), false)
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
  const judge = (text: string, trayItems?: { id: string; title: string }[]) => fallback({ meeting, recent: [{ speaker: 'x', text }], mode: 'command', trayItems }, 0, catalog)
  // People and company facts resolve to graph entities and show a card without the agent.
  const who = judge('kim jest Karol Bąk?')
  assert.equal(who.intent.id, 'person')
  assert.deepEqual([who.action, who.target, who.person.id], ['show', 'person', 'person:karol-bak'])
  const cost = judge('ile zapłaciliśmy za Pipedrive w sierpniu?')
  assert.equal(cost.intent.id, 'ask_company')
  assert.deepEqual([cost.action, cost.target, cost.topic.id, cost.facet.id], ['show', 'card', 'product:pipedrive', 'cost'])
  // Naming a person while asking for something else does not put them on screen.
  const mail = judge('napisz maila do Karola Bąka o fakturach')
  assert.equal(mail.intent.id, 'produce')
  assert.equal(mail.action, 'none')
  // Screen commands.
  assert.equal(judge('schowaj to').intent.id, 'ui_close')
  assert.equal(judge('odłóż to na później').intent.id, 'ui_background')
  assert.equal(judge('wyślij').intent.id, 'ui_send')
  assert.equal(judge('przesuń w górę').intent.id, 'ui_scroll_up')
  assert.equal(judge('scroll do góry').intent.id, 'ui_scroll_up')
  assert.equal(judge('przewiń niżej').intent.id, 'ui_scroll_down')
  assert.equal(judge('wyślij maila do Tomasza Kielara z podsumowaniem spotkania').intent.id, 'produce')
  const r = judge('otwórz raport o wydatkach', [{ id: 'a', title: 'Notatka: Beta Testing' }, { id: 'b', title: 'Raport: Wydatki na narzędzia' }])
  assert.equal(r.intent.id, 'ui_open')
  assert.equal(r.openTarget?.id, 'b')
  // Direct paths that skip the agent.
  assert.equal(judge('zrób punkty z ostatniego tematu').intent.id, 'ask_meeting')
  assert.equal(judge('co ustaliliśmy w sprawie Pipedrive?').intent.id, 'ask_meeting')
  assert.equal(judge('jaki jest dzisiaj kurs euro według NBP?').intent.id, 'ask_web')
  // Things to make, and the rest, go to the agent.
  assert.equal(judge('przygotuj raport o wydatkach na narzędzia').intent.id, 'produce')
  assert.equal(judge('narysuj wykres wydatków').intent.id, 'produce')
  assert.equal(judge('co to jest amortyzacja?').intent.id, 'ask')
  assert.equal(judge('kim jest Darek Wylon?').intent.id, 'ask', 'unknown person falls through to the agent')
})

test('ambient mode shows a card only for a clear question about a known entity', () => {
  const meeting = { title: 't', goal: '', participants: [] }
  const judge = (recent: string[]) => fallback({ meeting, recent: recent.map((text) => ({ speaker: 'x', text })), mode: 'ambient' }, 0, catalog)
  const asked = judge(['A właściwie ile my płacimy za Pipedrive?'])
  assert.deepEqual([asked.action, asked.topic.id, asked.facet.id], ['show', 'product:pipedrive', 'cost'])
  const followUp = judge(['A właściwie ile my płacimy za Pipedrive?', 'Kto to w ogóle zatwierdzał?'])
  assert.deepEqual([followUp.action, followUp.topic.id, followUp.facet.id], ['show', 'product:pipedrive', 'owner'])
  const statement = judge(['Pipedrive zostaje na razie bez zmian.'])
  assert.notEqual(statement.action, 'show')
  assert.equal(judge(['Mamy trzy tematy: koszty, Alfa i Beta Testing.']).action, 'none')
})

test('directory matches Polish name forms', () => {
  assert.equal(findContacts('wyślij maila do Tomasza Kielara')[0]?.email, 'k1eu@bielsko.ai')
  assert.equal(findContacts('napisz do Michała Staśkiewicza')[0]?.email, 'mikoscz@bielsko.ai')
  assert.equal(findContacts('do Michala')[0]?.email, 'mikoscz@bielsko.ai')
  assert.equal(findContacts('Kielarowi też')[0]?.email, 'k1eu@bielsko.ai')
  assert.equal(findContacts('do Anny Nowak').length, 0)
})
