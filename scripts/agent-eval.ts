import { runAgent } from '../src/server/agent.ts'
import { appendLines, clearSession, loadSession } from '../src/server/session.ts'

/**
 * Drives Bolek's agent from the terminal against a synthetic session.
 *
 *   node --env-file=.env scripts/agent-eval.ts                # fixed set
 *   node --env-file=.env scripts/agent-eval.ts "pytanie"      # one request
 */

const id = 'agent-eval'
clearSession(id)
const session = loadSession(id, 'Zarząd — test agenta')
const t0 = Date.now() - 10 * 60000
appendLines(session, [
  { id: 'n1', speaker: 'Tomasz · CEO', text: 'Dobra, Beta Testing. Umowa kończy się czternastego, Piotr, gdzie jesteśmy?', at: t0 },
  { id: 'n2', speaker: 'Piotr · CTO', text: 'Oferta jest na stole: 36 tysięcy za kwartał, dwóch testerów jak dotąd. Bez nich regresja przed wydaniem Gamma 28 listopada nie ma szans, wewnętrznie mamy jedną osobę.', at: t0 + 30000 },
  { id: 'n3', speaker: 'Michał · CFO', text: 'Trzy miesiące to 12 tysięcy miesięcznie. Pytałem ich o mniejszy zakres, jeden tester za 20 tysięcy kwartalnie, ale to nie domyka regresji.', at: t0 + 60000 },
  { id: 'n4', speaker: 'Anna · PM', text: 'Gamma Logistics czeka na termin. Jak przesuniemy wydanie, muszę ich uprzedzić do końca tygodnia.', at: t0 + 90000 },
  { id: 'n5', speaker: 'Tomasz · CEO', text: 'Czyli przedłużamy na jeden kwartał na starych warunkach, a Piotr do czwartku sprawdza alternatywy na kolejny. Michał, potwierdzenie pisemne musi wyjść do dwunastego.', at: t0 + 120000 },
  { id: 'n6', speaker: 'Michał · CFO', text: 'Jasne, wyślę w środę. Wracając do kosztów narzędzi, tam też jest kilka rzeczy do przeglądu.', at: t0 + 150000 },
])

const DEFAULT = [
  'ile zapłaciliśmy za Pipedrive w sierpniu i kto to zatwierdził?',
  'zrób punkty z tego, co przed chwilą omawialiśmy',
  'narysuj wykres miesięcznych wydatków na Pipedrive',
  'pokaż, co mamy teraz na naszym landingu',
  'wyślij do bolek@bielsko.ai maila z podsumowaniem ustaleń o Beta Testing',
  'ile gmin poprosiło o e-Doręczenia i jak wyszedł pilot?',
]
const requests = process.argv.slice(2).length ? [process.argv.slice(2).join(' ')] : DEFAULT

for (const r of requests) {
  const res = await runAgent(session, r)
  console.log(`\nQ: ${r}`)
  console.log(`   ${res.model} · ${res.latencyMs} ms · steps: ${res.steps.map((s) => `${s.tool}(${s.ms}ms${s.error ? ' ERR' : ''})`).join(' → ') || 'none'}${res.needsInput ? ' · NEEDS INPUT' : ''}`)
  if (res.headline) console.log(`   ▶ ${res.headline}`)
  console.log(`   ${res.answer}`)
  for (const b of res.bullets) console.log(`   • ${b}`)
  for (const a of res.attachments) console.log(`   [${a.type}] ${a.type === 'screenshot' ? a.pageUrl : a.type === 'document' ? a.title : a.type === 'chart' ? a.spec.title : a.type === 'email_draft' ? `${a.to.join(', ')} · ${a.subject}` : a.type === 'task' ? a.task.taskId : a.type === 'note' ? a.note.title : a.type === 'table' ? a.title : a.type === 'image' ? a.url : `${a.items.length} cytatów`}`)
}
