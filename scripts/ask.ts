import { answerFromGraph } from '../src/server/graph-answer.ts'

/**
 * Ask the company graph a question from the terminal, the way Bolek does.
 *
 *   node --env-file=.env scripts/ask.ts "Ile zapłaciliśmy za Pipedrive w sierpniu 2025?"
 *
 * With no argument, runs a fixed set of board-meeting questions.
 */

const DEFAULT_QUESTIONS = [
  'Ile zapłaciliśmy za Pipedrive w sierpniu 2025?',
  'Ile łącznie wydaliśmy na Pipedrive i kto to zatwierdził?',
  'Ile gmin poprosiło o e-Doręczenia i które?',
  'Jaki był wynik pilota z ConnectorCo?',
  'Dlaczego odrzuciliśmy Intercom?',
  'Ile kosztuje nas biuro w Krakowie?',
]

const questions = process.argv.slice(2).length ? [process.argv.slice(2).join(' ')] : DEFAULT_QUESTIONS

for (const q of questions) {
  const a = await answerFromGraph({ question: q })
  console.log(`\nQ: ${q}`)
  console.log(`   ${a.model} · ${a.latencyMs} ms · ${a.retrieval.nodes} nodes, ${a.retrieval.edges} edges, ${a.retrieval.chunks} chunks · ${a.confidence}${a.found ? '' : ' · NOT FOUND'}`)
  if (a.headline) console.log(`   ▶ ${a.headline}`)
  console.log(`   ${a.answer}`)
  for (const b of a.bullets) console.log(`   • ${b}`)
  for (const c of a.citations) console.log(`   [${c.id}] ${c.path}${c.date ? ` (${c.date})` : ''}`)
}
