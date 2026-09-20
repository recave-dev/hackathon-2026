import { detectRelevance } from '../src/server/relevance.ts'

/** Sends typical addressed requests through Jev (command mode) and prints the intent it picks. */
const CASES: [string, string][] = [
  ['zrób punkty z tego, co przed chwilą omawialiśmy o Beta Testing', 'meeting'],
  ['podsumuj całe spotkanie', 'meeting'],
  ['co Michał mówił o kosztach?', 'meeting'],
  ['przygotuj na następne spotkanie krótki raport o wydatkach na narzędzia', 'report'],
  ['napisz maila do Alfy z potwierdzeniem terminów', 'report'],
  ['zrób wykres wydatków na Pipedrive', 'report'],
  ['jaki jest dzisiaj kurs euro według NBP?', 'web'],
  ['co nowego u ConnectorCo w tym tygodniu?', 'web'],
  ['ile zapłaciliśmy za Pipedrive w sierpniu?', 'data'],
  ['kto zatwierdził Intercom?', 'data'],
  ['jaki był wynik pilota e-Doręczeń?', 'data'],
  ['kim jest Darek Wylon?', 'person'],
  ['nad czym pracuje Patrycja?', 'person'],
  ['co to są e-Doręczenia, w dwóch zdaniach?', 'general'],
  ['ile to jest 36 tysięcy razy cztery?', 'general'],
  ['przetłumacz "umowa ramowa" na angielski', 'general'],
]

let ok = 0
for (const [text, want] of CASES) {
  const r = await detectRelevance({ meeting: { title: 'Zarząd', goal: '', participants: [] }, recent: [{ speaker: 'Sala', text }], mode: 'command' })
  const got = r.action === 'show' && r.target === 'person' ? 'person' : r.intent.id
  const hit = got === want
  if (hit) ok++
  console.log(`${hit ? ' ok ' : ' XX '} ${String(r.latencyMs).padStart(4)}ms ${got.padEnd(8)} ${r.intent.confidence.toFixed(2)}  want ${want.padEnd(8)} "${text}"`)
}
console.log(`\n${ok}/${CASES.length}`)
