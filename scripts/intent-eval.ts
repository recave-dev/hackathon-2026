import { detectRelevance } from '../src/server/relevance.ts'

/** Sends typical addressed requests through Jev (command mode) and prints how it triages them. */
const TRAY = [
  { id: 'note-1', title: 'Notatka: Beta Testing – umowa' },
  { id: 'rep-1', title: 'Raport: Wydatki na narzędzia' },
  { id: 'chart-1', title: 'Wykres: wydatki na Pipedrive' },
]
const CASES: [string, string, string?][] = [
  ['kim jest Darek Wylon?', 'person'],
  ['nad czym pracuje Patrycja?', 'person'],
  ['schowaj to', 'ui_close'],
  ['dzięki, to wszystko', 'ui_close'],
  ['odłóż to na później, wrócimy do tego', 'ui_background'],
  ['przenieś to do tła', 'ui_background'],
  ['otwórz ten raport o wydatkach', 'ui_open', 'rep-1'],
  ['pokaż jeszcze raz tę notatkę', 'ui_open', 'note-1'],
  ['wróć do wykresu', 'ui_open', 'chart-1'],
  ['ok, wyślij', 'ui_send'],
  ['możesz to wysłać', 'ui_send'],
  ['ile zapłaciliśmy za Pipedrive w sierpniu?', 'ask'],
  ['zrób punkty z tego, co omawialiśmy', 'ask'],
  ['przygotuj raport o wydatkach na narzędzia', 'ask'],
  ['jaki jest kurs euro?', 'ask'],
  ['pokaż, co mamy na landingu', 'ask'],
  ['napisz maila do Alfy z potwierdzeniem terminów', 'ask'],
  ['co to są e-Doręczenia?', 'ask'],
]

let ok = 0
for (const [text, want, target] of CASES) {
  const r = await detectRelevance({ meeting: { title: 'Zarząd', goal: '', participants: [] }, recent: [{ speaker: 'Sala', text }], mode: 'command', trayItems: TRAY })
  const got = r.action === 'show' && r.target === 'person' ? 'person' : r.intent.id
  const hit = got === want && (!target || r.openTarget?.id === target)
  if (hit) ok++
  console.log(`${hit ? ' ok ' : ' XX '} ${String(r.latencyMs).padStart(4)}ms ${got.padEnd(13)} ${r.intent.confidence.toFixed(2)}${r.openTarget ? `  open=${r.openTarget.id ?? 'none'} ${r.openTarget.confidence.toFixed(2)}` : ''}  want ${want}${target ? `/${target}` : ''}  "${text}"`)
}
console.log(`\n${ok}/${CASES.length}`)
