import { FACET_HINT, KNOWLEDGE_CARDS, type Facet } from '../demo/knowledge.ts'
import { PEOPLE_CARDS } from '../demo/people.ts'
import { INTENTS, type Intent } from '../lib/intents.ts'

/**
 * Server-only: decides what the meeting screen should show for the latest
 * thing said. Two modes:
 *
 * - `ambient`: nobody addressed the assistant; show a card only when someone
 *   clearly asks for a fact about a known topic or person.
 * - `command`: the utterance was addressed to Bolek (name already stripped);
 *   resolve it to a person or a topic and show the best match.
 *
 * Uses the TypeSafe Jev model, directly (`TYPESAFE_API_KEY`) or through
 * OpenRouter (`OPENROUTER_API_KEY` or an `sk-or-` key). Without a key a
 * deterministic keyword matcher returns the same shape.
 */

export interface TranscriptTurn {
  speaker: string
  text: string
}

export type JudgeMode = 'ambient' | 'command'

export interface RelevanceInput {
  meeting: { title: string; goal: string; participants: string[] }
  /** Older turns first; the last one is the utterance being judged. */
  recent: TranscriptTurn[]
  mode?: JudgeMode
}

export type RelevanceAction = 'show' | 'mention' | 'none'
export type RelevanceTarget = 'card' | 'person'

export interface RelevanceResult {
  engine: 'jev' | 'fallback'
  /** Which transport answered when the engine is Jev. */
  via?: 'typesafe' | 'openrouter'
  model?: string
  latencyMs: number
  mode: JudgeMode
  /** Probability that the latest utterance asks for a company fact (ambient) or is a lookup request (command). */
  needsInfo: number
  topic: { id: string | null; confidence: number; probabilities: Record<string, number> }
  person: { id: string | null; confidence: number }
  facet: { id: Facet; confidence: number }
  /** Command mode: what kind of request this is. */
  intent: { id: Intent; confidence: number }
  action: RelevanceAction
  /** What `show` refers to: `topic.id` for a card, `person.id` for a person. */
  target: RelevanceTarget | null
  error?: string
}

/** Thresholds: Polish speech scores lower than English, so these are lenient. */
const SHOW_NEEDS_INFO = 0.5
const SHOW_TOPIC_CONFIDENCE = 0.35
const SHOW_PERSON_CONFIDENCE = 0.4
const MENTION_TOPIC_PROBABILITY = 0.5
/** In command mode the room asked explicitly, so almost any match is worth showing. */
const COMMAND_MIN_CONFIDENCE = 0.2

const FACETS = Object.keys(FACET_HINT) as Facet[]

interface Scores {
  needsInfo: number
  topicId: string | null
  topicConfidence: number
  topicProbability: number
  personId: string | null
  personConfidence: number
  /** Command mode only: did the request read as about a person? */
  asksPerson: number
}

function decide(mode: JudgeMode, s: Scores): { action: RelevanceAction; target: RelevanceTarget | null } {
  if (mode === 'command') {
    const person = s.personId && s.personConfidence >= COMMAND_MIN_CONFIDENCE
    const topic = s.topicId && s.topicConfidence >= COMMAND_MIN_CONFIDENCE
    if (person && (s.asksPerson >= 0.5 || !topic)) return { action: 'show', target: 'person' }
    if (topic) return { action: 'show', target: 'card' }
    if (person) return { action: 'show', target: 'person' }
    return { action: 'none', target: null }
  }
  if (s.needsInfo >= SHOW_NEEDS_INFO) {
    if (s.topicId && s.topicConfidence >= SHOW_TOPIC_CONFIDENCE) return { action: 'show', target: 'card' }
    if (s.personId && s.personConfidence >= SHOW_PERSON_CONFIDENCE) return { action: 'show', target: 'person' }
  }
  if (s.topicId && s.topicProbability >= MENTION_TOPIC_PROBABILITY) return { action: 'mention', target: 'card' }
  return { action: 'none', target: null }
}

type Transport = { via: 'openrouter'; apiKey: string; model: string } | { via: 'typesafe'; apiKey: string }

function transport(): Transport | null {
  const openrouter = process.env.OPENROUTER_API_KEY?.trim()
  const typesafe = process.env.TYPESAFE_API_KEY?.trim()
  const model = process.env.JEV_MODEL?.trim() || 'typesafe/jev-1.13'
  if (openrouter) return { via: 'openrouter', apiKey: openrouter, model }
  if (typesafe?.startsWith('sk-or-')) return { via: 'openrouter', apiKey: typesafe, model }
  if (typesafe) return { via: 'typesafe', apiKey: typesafe }
  return null
}

export async function detectRelevance(input: RelevanceInput): Promise<RelevanceResult> {
  const latest = input.recent.at(-1)
  const t = transport()
  if (!latest || !t) return fallback(input, 0)
  const started = performance.now()
  try {
    return await withJev(input, t, started)
  } catch (err) {
    const result = fallback(input, performance.now() - started)
    result.error = err instanceof Error ? err.message : String(err)
    return result
  }
}

const NONE_TOPIC = 'None of the listed topics; small talk, agenda, or something the company records do not cover.'
const NONE_PERSON = 'No listed person is being asked about.'

/** Questions Jev answers in one pass. Plain JSON: both transports accept the same shape. */
function buildRequest(input: RelevanceInput, mode: JudgeMode) {
  const latest = input.recent.at(-1)!
  const earlier = input.recent.slice(0, -1)

  const topicCriteria: Record<string, string> = Object.fromEntries(KNOWLEDGE_CARDS.map((c) => [c.id, c.hint]))
  topicCriteria.none = NONE_TOPIC
  const personCriteria: Record<string, string> = Object.fromEntries(PEOPLE_CARDS.map((p) => [p.id, p.hint]))
  personCriteria.none = NONE_PERSON

  const state = {
    context:
      mode === 'command'
        ? 'Live transcript of a Polish company board meeting. Someone just addressed the meeting assistant "Bolek" by name; latest_utterance is their request with the name removed. Speech is in Polish.'
        : 'Live transcript of a Polish company board meeting. Speech is in Polish. The assistant may show one knowledge card on the meeting screen.',
    meeting: input.meeting,
    earlier_turns: earlier.map((t) => `${t.speaker}: ${t.text}`),
    latest_utterance: { speaker: latest.speaker, text: latest.text },
  }

  const questions = {
    needs_info: {
      type: 'noul' as const,
      instructions:
        mode === 'command'
          ? 'Is latest_utterance a request to look something up or show something: who a person is, what they do, what something costs, who owns it, a date, a status?'
          : 'Judge only latest_utterance. Does the speaker ask for, or clearly wonder about, a company fact that records could answer right now: a cost, a price, who approved or owns something, a date or deadline, a status or result, what happened before, what the options are, or who a person is?',
      criteria: {
        true: 'The utterance contains a question or an open wondering about such a fact, even if the topic is only implied by earlier_turns.',
        false: 'Greetings, agenda moves, opinions, plans, confirmations, or statements that need no lookup.',
      },
    },
    asks_person: {
      type: 'noul' as const,
      instructions: 'Is latest_utterance primarily about a person: who they are, their role, what they own or are working on, how to reach them?',
      criteria: { true: 'The subject is a person or their role and work.', false: 'The subject is a tool, vendor, project, cost, contract or date.' },
    },
    person: {
      type: 'choice' as const,
      instructions: 'Which listed person is latest_utterance about? Match first names, surnames and Polish declensions (Darka, Piotrem, Patrycję). Choose none when no listed person is meant.',
      criteria: personCriteria,
    },
    topic: {
      type: 'choice' as const,
      instructions:
        'Which company topic is latest_utterance about? Use earlier_turns only to resolve follow-ups such as "and who approved it?". Choose none when no listed topic fits.',
      criteria: topicCriteria,
    },
    facet: {
      type: 'choice' as const,
      instructions: 'Which angle does latest_utterance ask about?',
      criteria: FACET_HINT as Record<string, string>,
    },
    intent: {
      type: 'choice' as const,
      instructions: 'What kind of request is latest_utterance? Pick the action the assistant should take.',
      criteria: Object.fromEntries(INTENTS.map((i) => [i.id, i.hint])) as Record<string, string>,
    },
  }

  return { state, questions }
}

interface ChoiceAnswer {
  type: 'choice'
  choice: string
  confidence?: number
  probabilities?: Record<string, number>
}

interface JevAnswers {
  needs_info: { type: 'noul'; noul: number }
  asks_person: { type: 'noul'; noul: number }
  person: ChoiceAnswer
  topic: ChoiceAnswer
  facet: ChoiceAnswer
  intent: ChoiceAnswer
}

async function withJev(input: RelevanceInput, t: Transport, started: number): Promise<RelevanceResult> {
  const mode: JudgeMode = input.mode ?? 'ambient'
  const { state, questions } = buildRequest(input, mode)
  let answers: JevAnswers
  let model: string

  if (t.via === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: t.model, state, questions }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = (await res.json()) as { model: string; answers: JevAnswers }
    answers = body.answers
    model = body.model
  } else {
    const { TypeSafeClient } = await import('@typesafe-ai/sdk')
    const client = new TypeSafeClient({ apiKey: t.apiKey, timeout: 4000, retry: { maxRetries: 0 } })
    const res = await client.systemOne({ state, questions })
    answers = res.answers as unknown as JevAnswers
    model = res.model
  }

  const pick = (a: ChoiceAnswer) => {
    const id = a.choice === 'none' ? null : a.choice
    const probabilities = { ...(a.probabilities ?? {}) }
    const probability = id ? (probabilities[id] ?? 0) : 0
    return { id, probabilities, probability, confidence: a.confidence ?? probability }
  }
  const topic = pick(answers.topic)
  const person = pick(answers.person)
  const facet = (FACETS.includes(answers.facet.choice as Facet) ? answers.facet.choice : 'general') as Facet
  const intentId = (INTENTS.some((i) => i.id === answers.intent.choice) ? answers.intent.choice : 'general') as Intent

  const scores: Scores = {
    needsInfo: answers.needs_info.noul,
    topicId: topic.id,
    topicConfidence: topic.confidence,
    topicProbability: topic.probability,
    personId: person.id,
    personConfidence: person.confidence,
    asksPerson: answers.asks_person.noul,
  }

  return {
    engine: 'jev',
    via: t.via,
    model,
    latencyMs: Math.round(performance.now() - started),
    mode,
    needsInfo: scores.needsInfo,
    topic: { id: topic.id, confidence: topic.confidence, probabilities: topic.probabilities },
    person: { id: person.id, confidence: person.confidence },
    facet: { id: facet, confidence: answers.facet.confidence ?? 0 },
    intent: { id: intentId, confidence: answers.intent.confidence ?? 0 },
    ...decide(mode, scores),
  }
}

const INTENT_MARKERS: [Intent, string[]][] = [
  ['meeting', ['podsumuj', 'podsumowanie', 'bullet', 'punkty', 'notatk', 'co ustaliliśmy', 'co powiedział', 'co mówił', 'ostatni temat', 'omawialiśmy', 'action item', 'zadania z', 'streszcz']],
  ['report', ['przygotuj', 'napisz', 'zrób raport', 'raport', 'dokument', 'wykres', 'wizualizacj', 'prezentacj', 'mail do', 'maila do', 'plan ']],
  ['web', ['w internecie', 'wygoogluj', 'sprawdź w sieci', 'kurs ', 'newsy', 'wiadomości', 'konkurenc', 'na rynku', 'ustaw', 'przepis', 'cena rynkowa']],
  ['person', ['kim jest', 'kto to', 'czym się zajmuje', 'nad czym pracuje', 'za co odpowiada']],
]

const QUESTION_MARKERS = ['?', 'ile ', 'kto ', 'kim ', 'kiedy', 'do kiedy', 'jak ', 'czy ', 'co z ', 'jakie ', 'który', 'która', 'gdzie', 'dlaczego', 'nad czym', 'za co']
const PERSON_MARKERS = ['kim jest', 'kto to', 'kto jest', 'czym się zajmuje', 'nad czym', 'pracuje', 'za co odpowiada', 'co robi']

const FACET_MARKERS: [Facet, string[]][] = [
  ['cost', ['ile', 'koszt', 'płac', 'cen', 'kwot', 'budżet', 'oszczędz', 'zł', 'eur', 'tysi', 'faktur', 'chciał']],
  ['owner', ['kto ', 'zatwierdz', 'odpowiada', 'właścic', 'prowadził', 'prowadzi', 'decyd']],
  ['deadline', ['kiedy', 'termin', 'do kiedy', 'data', 'dzień', 'tydz', 'kończy', 'deadline', 'listopad', 'grudni', 'start ']],
  ['status', ['jak wyszed', 'jak wyszł', 'wynik', 'status', 'gdzie jesteśmy', 'co z ', 'jak idzie', 'udało']],
  ['history', ['w końcu', 'wcześniej', 'ostatnio', 'wtedy', 'poprzedni', 'historia', 'dlaczego', 'wzięliśmy']],
  ['options', ['opcj', 'alternatyw', 'możemy', 'co jeśli', 'jeśli nie', 'zamiast', 'wybór']],
]

function aliasScores<T extends { id: string; aliases: string[] }>(items: T[], latest: string, earlier: string): Record<string, number> {
  const scores = Object.fromEntries(items.map((c) => [c.id, 0])) as Record<string, number>
  for (const item of items) {
    for (const alias of item.aliases) {
      if (latest.includes(alias)) scores[item.id] += 1
      else if (earlier.includes(alias)) scores[item.id] += 0.4
    }
  }
  return scores
}

function best(scores: Record<string, number>): { id: string | null; confidence: number; score: number } {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [id, score] = ranked[0] ?? ['', 0]
  const total = ranked.reduce((sum, [, s]) => sum + s, 0)
  return { id: score > 0 ? id : null, confidence: total > 0 ? score / total : 0, score }
}

/** Keyword matcher used when Jev is unavailable. Same shape, no probabilities to speak of. */
export function fallback(input: RelevanceInput, elapsedMs: number): RelevanceResult {
  const mode: JudgeMode = input.mode ?? 'ambient'
  const latest = input.recent.at(-1)?.text.toLowerCase() ?? ''
  const earlier = input.recent
    .slice(-3, -1)
    .map((t) => t.text.toLowerCase())
    .join(' ')

  // In command mode the request is explicit, so only the current line counts.
  const topicScores = aliasScores(KNOWLEDGE_CARDS, latest, mode === 'command' ? '' : earlier)
  // People only match on the current line: a name said two turns ago is not a lookup.
  const personScores = aliasScores(PEOPLE_CARDS, latest, '')
  const topic = best(topicScores)
  const person = best(personScores)

  const asks = mode === 'command' || QUESTION_MARKERS.some((m) => latest.includes(m))
  const needsInfo = asks ? 0.9 : 0.1
  const asksPerson = PERSON_MARKERS.some((m) => latest.includes(m)) ? 0.9 : person.score > 0 && topic.score === 0 ? 0.7 : 0.1

  let facet: Facet = 'general'
  let facetHits = 0
  for (const [id, markers] of FACET_MARKERS) {
    const hits = markers.filter((m) => latest.includes(m)).length
    if (hits > facetHits) {
      facet = id
      facetHits = hits
    }
  }

  const scores: Scores = {
    needsInfo,
    topicId: topic.id,
    topicConfidence: topic.confidence,
    topicProbability: topic.score > 0 ? Math.max(topic.confidence, 0.5) : 0,
    personId: person.id,
    personConfidence: person.confidence,
    asksPerson,
  }

  let intent: Intent = topic.score > 0 || person.score > 0 ? 'data' : 'general'
  for (const [id, markers] of INTENT_MARKERS) {
    if (markers.some((m) => latest.includes(m))) {
      intent = id
      break
    }
  }
  if (intent === 'person' && !person.id) intent = 'data'

  return {
    engine: 'fallback',
    latencyMs: Math.round(elapsedMs),
    mode,
    needsInfo,
    topic: { id: topic.id, confidence: topic.confidence, probabilities: topicScores },
    person: { id: person.id, confidence: person.confidence },
    facet: { id: facet, confidence: facetHits > 0 ? 0.8 : 0.3 },
    intent: { id: intent, confidence: 0.6 },
    ...decide(mode, scores),
  }
}
