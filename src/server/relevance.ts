import { FACET_HINT, KNOWLEDGE_CARDS, type Facet } from '../demo/knowledge.ts'

/**
 * Server-only: decides whether the latest thing said in a meeting deserves a
 * knowledge card on screen, and which one. Uses the TypeSafe Jev model, either
 * directly (`TYPESAFE_API_KEY`) or through OpenRouter (`OPENROUTER_API_KEY` or
 * an `sk-or-` key). Without a key a deterministic keyword matcher returns the
 * same shape, so the demo keeps working offline.
 */

export interface TranscriptTurn {
  speaker: string
  text: string
}

export interface RelevanceInput {
  meeting: { title: string; goal: string; participants: string[] }
  /** Older turns first; the last one is the utterance being judged. */
  recent: TranscriptTurn[]
}

export type RelevanceAction = 'show' | 'mention' | 'none'

export interface RelevanceResult {
  engine: 'jev' | 'fallback'
  /** Which transport answered when the engine is Jev. */
  via?: 'typesafe' | 'openrouter'
  model?: string
  latencyMs: number
  /** Probability that the latest utterance asks for a company fact. */
  needsInfo: number
  topic: { id: string | null; confidence: number; probabilities: Record<string, number> }
  facet: { id: Facet; confidence: number }
  action: RelevanceAction
  error?: string
}

/** Thresholds: Polish speech scores lower than English, so these are lenient. */
const SHOW_NEEDS_INFO = 0.5
const SHOW_TOPIC_CONFIDENCE = 0.35
const MENTION_TOPIC_PROBABILITY = 0.5

const FACETS = Object.keys(FACET_HINT) as Facet[]

function decide(needsInfo: number, topicId: string | null, confidence: number, topicProbability: number): RelevanceAction {
  if (!topicId) return 'none'
  if (needsInfo >= SHOW_NEEDS_INFO && confidence >= SHOW_TOPIC_CONFIDENCE) return 'show'
  if (topicProbability >= MENTION_TOPIC_PROBABILITY) return 'mention'
  return 'none'
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

/** The three questions Jev answers in one pass. Plain JSON: both transports accept the same shape. */
function buildRequest(input: RelevanceInput) {
  const latest = input.recent.at(-1)!
  const earlier = input.recent.slice(0, -1)

  const topicCriteria: Record<string, string> = Object.fromEntries(KNOWLEDGE_CARDS.map((c) => [c.id, c.hint]))
  topicCriteria.none = 'None of the listed topics; small talk, agenda, or something the company records do not cover.'

  const state = {
    context: 'Live transcript of a Polish company board meeting. Speech is in Polish. The assistant may show one knowledge card on the meeting screen.',
    meeting: input.meeting,
    earlier_turns: earlier.map((t) => `${t.speaker}: ${t.text}`),
    latest_utterance: { speaker: latest.speaker, text: latest.text },
  }

  const questions = {
    needs_info: {
      type: 'noul' as const,
      instructions:
        'Judge only latest_utterance. Does the speaker ask for, or clearly wonder about, a company fact that records could answer right now: a cost, a price, who approved or owns something, a date or deadline, a status or result, what happened before, or what the options are?',
      criteria: {
        true: 'The utterance contains a question or an open wondering about such a fact, even if the topic is only implied by earlier_turns.',
        false: 'Greetings, agenda moves, opinions, plans, confirmations, or statements that need no lookup.',
      },
    },
    topic: {
      type: 'choice' as const,
      instructions:
        'Which company topic is latest_utterance about? Use earlier_turns only to resolve follow-ups such as "and who approved it?". Choose none when no listed topic fits.',
      criteria: topicCriteria,
    },
    facet: {
      type: 'choice' as const,
      instructions: 'Which angle of that topic does latest_utterance ask about?',
      criteria: FACET_HINT as Record<string, string>,
    },
  }

  return { state, questions }
}

interface JevAnswers {
  needs_info: { type: 'noul'; noul: number }
  topic: { type: 'choice'; choice: string; confidence?: number; probabilities?: Record<string, number> }
  facet: { type: 'choice'; choice: string; confidence?: number; probabilities?: Record<string, number> }
}

async function withJev(input: RelevanceInput, t: Transport, started: number): Promise<RelevanceResult> {
  const { state, questions } = buildRequest(input)
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

  const topicChoice = answers.topic.choice
  const topicId = topicChoice === 'none' ? null : topicChoice
  const probabilities = { ...(answers.topic.probabilities ?? {}) }
  const topicProbability = topicId ? (probabilities[topicId] ?? 0) : 0
  const topicConfidence = answers.topic.confidence ?? topicProbability
  const facet = (FACETS.includes(answers.facet.choice as Facet) ? answers.facet.choice : 'general') as Facet

  return {
    engine: 'jev',
    via: t.via,
    model,
    latencyMs: Math.round(performance.now() - started),
    needsInfo: answers.needs_info.noul,
    topic: { id: topicId, confidence: topicConfidence, probabilities },
    facet: { id: facet, confidence: answers.facet.confidence ?? 0 },
    action: decide(answers.needs_info.noul, topicId, topicConfidence, topicProbability),
  }
}

const QUESTION_MARKERS = ['?', 'ile ', 'kto ', 'kiedy', 'do kiedy', 'jak ', 'czy ', 'co z ', 'jakie ', 'który', 'która', 'gdzie', 'dlaczego']

const FACET_MARKERS: [Facet, string[]][] = [
  ['cost', ['ile', 'koszt', 'płac', 'cen', 'kwot', 'budżet', 'oszczędz', 'zł', 'eur', 'tysi', 'faktur', 'chciał']],
  ['owner', ['kto ', 'zatwierdz', 'odpowiada', 'właścic', 'prowadził', 'prowadzi', 'decyd']],
  ['deadline', ['kiedy', 'termin', 'do kiedy', 'data', 'dzień', 'tydz', 'kończy', 'deadline', 'listopad', 'grudni', 'start ']],
  ['status', ['jak wyszed', 'jak wyszł', 'wynik', 'status', 'gdzie jesteśmy', 'co z ', 'jak idzie', 'udało']],
  ['history', ['w końcu', 'wcześniej', 'ostatnio', 'wtedy', 'poprzedni', 'historia', 'dlaczego', 'wzięliśmy']],
  ['options', ['opcj', 'alternatyw', 'możemy', 'co jeśli', 'jeśli nie', 'zamiast', 'wybór']],
]

/** Keyword matcher used when Jev is unavailable. Same shape, no probabilities to speak of. */
export function fallback(input: RelevanceInput, elapsedMs: number): RelevanceResult {
  const latest = input.recent.at(-1)?.text.toLowerCase() ?? ''
  const earlier = input.recent
    .slice(-3, -1)
    .map((t) => t.text.toLowerCase())
    .join(' ')

  const scores = Object.fromEntries(KNOWLEDGE_CARDS.map((c) => [c.id, 0])) as Record<string, number>
  for (const card of KNOWLEDGE_CARDS) {
    for (const alias of card.aliases) {
      if (latest.includes(alias)) scores[card.id] += 1
      else if (earlier.includes(alias)) scores[card.id] += 0.4
    }
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [bestId, bestScore] = ranked[0] ?? ['', 0]
  const total = ranked.reduce((sum, [, s]) => sum + s, 0)
  const topicId = bestScore > 0 ? bestId : null
  const confidence = total > 0 ? bestScore / total : 0

  const asks = QUESTION_MARKERS.some((m) => latest.includes(m))
  const needsInfo = asks ? 0.9 : 0.1

  let facet: Facet = 'general'
  let facetHits = 0
  for (const [id, markers] of FACET_MARKERS) {
    const hits = markers.filter((m) => latest.includes(m)).length
    if (hits > facetHits) {
      facet = id
      facetHits = hits
    }
  }

  return {
    engine: 'fallback',
    latencyMs: Math.round(elapsedMs),
    needsInfo,
    topic: { id: topicId, confidence, probabilities: scores },
    facet: { id: facet, confidence: facetHits > 0 ? 0.8 : 0.3 },
    action: decide(needsInfo, topicId, confidence, bestScore > 0 ? Math.max(confidence, 0.5) : 0),
  }
}
