import { judgeFocusCommand, type FocusCommand, type FocusInput } from '../src/server/focus.ts'
import { detectRelevance } from '../src/server/relevance.ts'

/** Sends focus-mode lines through Jev and prints the command and latency; then a few "open the deck" requests. */
const focus: FocusInput['focus'] = {
  kind: 'presentation',
  title: 'Zarząd — przegląd Q3 2026',
  position: 3,
  total: 7,
  itemTitles: ['Przegląd Q3 2026', 'Sprzedaż i pipeline', 'CivicFlow 4.3', 'Wdrożenia', 'Koszty narzędzi', 'Ryzyka', 'Decyzje na dziś'],
}

const CASES: [string, FocusCommand, number?][] = [
  ['następny slajd', 'next'],
  ['dalej', 'next'],
  ['idziemy dalej', 'next'],
  ['poprzedni', 'prev'],
  ['wróć', 'prev'],
  ['cofnij o jeden', 'prev'],
  ['od początku', 'first'],
  ['ostatni slajd', 'last'],
  ['slajd trzeci', 'goto', 3],
  ['pokaż piąty slajd', 'goto', 5],
  ['przejdź do ryzyk', 'goto', 6],
  ['pokaż koszty narzędzi', 'goto', 5],
  ['zamknij prezentację', 'close'],
  ['zamknij', 'close'],
  ['dzięki, wystarczy', 'close'],
  ['to jest ciekawa liczba', 'none'],
  ['ile płacimy za Pipedrive?', 'none'],
  ['Marta, co o tym sądzisz?', 'none'],
  ['zgadzam się, dwa miejsca więcej', 'none'],
]

let ok = 0
for (const [text, want, target] of CASES) {
  const r = await judgeFocusCommand({ text, focus })
  const hit = r.command === want && (!target || r.target === target)
  if (hit) ok++
  console.log(`${hit ? ' ok ' : ' XX '} ${String(r.latencyMs).padStart(4)}ms ${r.engine.padEnd(8)} ${r.command.padEnd(6)} ${r.confidence.toFixed(2)}${r.target ? ` →${r.target}` : ''}  want ${want}${target ? `/${target}` : ''}  "${text}"${r.error ? `  (${r.error})` : ''}`)
}
console.log(`\nfocus: ${ok}/${CASES.length}\n`)

const DECKS = [
  { id: 'zarzad-q3-2026', title: 'Zarząd — przegląd Q3 2026' },
  { id: 'wdrozenie-alfa-status', title: 'Wdrożenie Alfa — status' },
  { id: 'budzet-2027', title: 'Budżet 2027 — pierwsza wersja' },
]
const OPEN: [string, string][] = [
  ['otwórz prezentację o budżecie', 'budzet-2027'],
  ['pokaż slajdy z wdrożenia Alfy', 'wdrozenie-alfa-status'],
  ['odpal prezentację z przeglądu kwartału', 'zarzad-q3-2026'],
  ['otwórz prezentację zarządu', 'zarzad-q3-2026'],
]
let ok2 = 0
for (const [text, want] of OPEN) {
  const r = await detectRelevance({ meeting: { title: 'Zarząd', goal: '', participants: [] }, recent: [{ speaker: 'Sala', text }], mode: 'command', presentations: DECKS })
  const hit = r.intent.id === 'ui_present' && r.presentation?.id === want
  if (hit) ok2++
  console.log(`${hit ? ' ok ' : ' XX '} ${String(r.latencyMs).padStart(4)}ms ${r.intent.id.padEnd(12)} ${r.intent.confidence.toFixed(2)}  deck=${r.presentation?.id ?? 'none'} ${(r.presentation?.confidence ?? 0).toFixed(2)}  want ${want}  "${text}"`)
}
console.log(`\nopen: ${ok2}/${OPEN.length}`)
