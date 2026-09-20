import { detectRelevance } from '../src/server/relevance.ts'

/**
 * Sends typical addressed requests through Jev (command mode) and prints how
 * it triages them: which intent, and for company questions which graph entity
 * and facet the card would be built from.
 *
 *   node --env-file=.env scripts/intent-eval.ts
 */
const TRAY = [
  { id: 'note-1', title: 'Notatka: Beta Testing – umowa' },
  { id: 'rep-1', title: 'Raport: Wydatki na narzędzia' },
  { id: 'chart-1', title: 'Wykres: wydatki na Pipedrive' },
]
/** [utterance, wanted intent or "person"/"card", wanted target id (tray item, person or topic), wanted facet] */
const CASES: [string, string, string?, string?][] = [
  ['kim jest Karol Bąk?', 'person', 'person:karol-bak'],
  ['nad czym pracuje Ewa Mazur?', 'person', 'person:ewa-mazur'],
  ['ile płacimy za Pipedrive?', 'card', 'product:pipedrive', 'cost'],
  ['kto zatwierdził Pipedrive?', 'card', 'product:pipedrive', 'owner'],
  ['jak wyszedł pilot e-Doręczeń?', 'card', 'product:edoreczenia', 'status'],
  ['jakie mamy opcje dla e-Doręczeń?', 'card', 'product:edoreczenia', 'options'],
  ['a LeadBooster w końcu wzięliśmy?', 'card', 'decision:purchase-pipedrive-leadbooster-2025-07'],
  ['co ConnectorCo nam zaproponowało?', 'card', 'organization:connectorco'],
  ['schowaj to', 'ui_close'],
  ['dzięki, to wszystko', 'ui_close'],
  ['odłóż to na później, wrócimy do tego', 'ui_background'],
  ['przenieś to do tła', 'ui_background'],
  ['otwórz ten raport o wydatkach', 'ui_open', 'rep-1'],
  ['pokaż jeszcze raz tę notatkę', 'ui_open', 'note-1'],
  ['wróć do wykresu', 'ui_open', 'chart-1'],
  ['przesuń w górę', 'ui_scroll_up'],
  ['scroll do góry', 'ui_scroll_up'],
  ['przewiń niżej', 'ui_scroll_down'],
  ['ok, wyślij', 'ui_send'],
  ['możesz to wysłać', 'ui_send'],
  ['wyślij maila do Tomasza Kielara z podsumowaniem spotkania', 'produce'],
  ['wyślij Tomkowi krótkie podsumowanie', 'produce'],
  ['zrób punkty z tego, co omawialiśmy', 'ask_meeting'],
  ['co ustaliliśmy w sprawie Beta Testing?', 'ask_meeting'],
  ['jaki jest kurs euro?', 'ask_web'],
  ['znajdź 3 lokale w Bielsku, które są w stanie pomieścić tyle osób, i porównaj je w tabeli', 'ask_company'],
  ['porównaj statystyki meetupu 001 i 002', 'ask_company'],
  ['zrób grafikę na meetup 003', 'produce'],
  ['zaktualizuj stronę bielsko.ai: meetup 003 w NovaPatria, 30 października o 17:00', 'produce'],
  ['wyślij email z podsumowaniem do Tomka Kielara', 'produce'],
  ['przygotuj raport o wydatkach na narzędzia', 'produce'],
  ['pokaż, co mamy na landingu', 'produce'],
  ['napisz maila do Karola Bąka z potwierdzeniem terminów', 'produce'],
  ['co to są e-Doręczenia w ogóle, tak ogólnie?', 'ask'],
]

let ok = 0
for (const [text, want, target, facet] of CASES) {
  const r = await detectRelevance({ meeting: { title: 'Zarząd', goal: '', participants: [] }, recent: [{ speaker: 'Sala', text }], mode: 'command', trayItems: TRAY })
  const got = r.action === 'show' && r.target ? (r.target === 'person' ? 'person' : 'card') : r.intent.id
  const gotTarget = got === 'person' ? r.person.id : got === 'card' ? r.topic.id : r.openTarget?.id
  const hit = got === want && (!target || gotTarget === target) && (!facet || r.facet.id === facet)
  if (hit) ok++
  console.log(`${hit ? ' ok ' : ' XX '} ${String(r.latencyMs).padStart(4)}ms ${got.padEnd(12)} ${r.intent.id.padEnd(12)} ${r.intent.confidence.toFixed(2)} ${(gotTarget ?? '-').padEnd(48)} ${r.facet.id.padEnd(8)} want ${want}${target ? `/${target}` : ''}${facet ? `/${facet}` : ''}  "${text}"`)
}
console.log(`\n${ok}/${CASES.length}`)
