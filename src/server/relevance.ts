import { FACET_HINT, type Facet } from '../demo/knowledge.ts'
import { INTENTS, type Intent } from '../lib/intents.ts'
import { matchDeck } from '../lib/slides.ts'
import { fold, graphCatalog, parentTopic, type GraphCatalog } from './graph-cards.ts'
import { openGraph } from './graph-answer.ts'
import { askJev, jevTransport, type JevChoice, type JevNoul, type JevTransport } from './jev.ts'

/**
 * Server-only: decides what the meeting screen should show for the latest
 * thing said. Two modes:
 *
 * - `ambient`: nobody addressed the assistant; show a card only when someone
 *   clearly asks for a fact about a known topic or person.
 * - `command`: the utterance was addressed to Bolek (name already stripped);
 *   triage the intent, and resolve company questions to a topic or a person
 *   from the graph so the card can be built without a language model.
 *
 * The topics and people Jev chooses from come from the company graph
 * (`graph-cards.ts`), never from hand-written lists. Uses the TypeSafe Jev
 * model, directly (`TYPESAFE_API_KEY`) or through OpenRouter
 * (`OPENROUTER_API_KEY` or an `sk-or-` key). Without a key a deterministic
 * keyword matcher returns the same shape.
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
  /** Things currently in the tray, so "otwórz raport" can be resolved to one of them. */
  trayItems?: { id: string; title: string }[]
  /** Stored presentations, so "otwórz prezentację o budżecie" can be resolved to one of them. */
  presentations?: { id: string; title: string }[]
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
  /** Graph entity ids. */
  topic: { id: string | null; confidence: number; probabilities: Record<string, number> }
  person: { id: string | null; confidence: number }
  facet: { id: Facet; confidence: number }
  /** Command mode: what kind of request this is. */
  intent: { id: Intent; confidence: number }
  /** Command mode with tray items: which tray item an "open" request refers to. */
  openTarget?: { id: string | null; confidence: number }
  /** Command mode with stored presentations: which deck an "open the presentation" request refers to. */
  presentation?: { id: string | null; confidence: number }
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

function decide(mode: JudgeMode, s: Scores, intent: Intent): { action: RelevanceAction; target: RelevanceTarget | null } {
  if (mode === 'command') {
    const person = Boolean(s.personId) && s.personConfidence >= COMMAND_MIN_CONFIDENCE
    const topic = Boolean(s.topicId) && s.topicConfidence >= COMMAND_MIN_CONFIDENCE
    // Only lookups put a card on screen; "napisz maila do Karola" keeps Karol off the screen.
    if (intent === 'person' && person) return { action: 'show', target: 'person' }
    if (intent === 'ask_company') {
      if (person && s.asksPerson >= 0.5 && !topic) return { action: 'show', target: 'person' }
      if (topic) return { action: 'show', target: 'card' }
      if (person && s.asksPerson >= 0.5) return { action: 'show', target: 'person' }
    }
    if (intent === 'ask' && person && s.asksPerson >= 0.6 && !topic) return { action: 'show', target: 'person' }
    return { action: 'none', target: null }
  }
  if (s.needsInfo >= SHOW_NEEDS_INFO) {
    if (s.topicId && s.topicConfidence >= SHOW_TOPIC_CONFIDENCE) return { action: 'show', target: 'card' }
    // Colleagues get addressed by name all the time; a person card needs a question about the person.
    if (s.personId && s.personConfidence >= SHOW_PERSON_CONFIDENCE && s.asksPerson >= 0.5) return { action: 'show', target: 'person' }
  }
  if (s.topicId && s.topicProbability >= MENTION_TOPIC_PROBABILITY) return { action: 'mention', target: 'card' }
  return { action: 'none', target: null }
}

function catalogOrEmpty(): GraphCatalog {
  try {
    return graphCatalog()
  } catch (err) {
    console.warn('relevance: graph unavailable', err instanceof Error ? err.message : err)
    return { company: null, topics: [], people: [] }
  }
}

export async function detectRelevance(input: RelevanceInput): Promise<RelevanceResult> {
  const latest = input.recent.at(-1)
  const t = jevTransport()
  const catalog = catalogOrEmpty()
  if (!latest || !t) return fallback(input, 0, catalog)
  const started = performance.now()
  try {
    return await withJev(input, t, started, catalog)
  } catch (err) {
    const result = fallback(input, performance.now() - started, catalog)
    result.error = err instanceof Error ? err.message : String(err)
    return result
  }
}

const NONE_TOPIC = 'None of the listed topics; small talk, agenda, or something the company records do not cover.'
const NONE_PERSON = 'No listed person is being asked about.'

/** Questions Jev answers in one pass. Plain JSON: both transports accept the same shape. */
function buildRequest(input: RelevanceInput, mode: JudgeMode, catalog: GraphCatalog) {
  const latest = input.recent.at(-1)!
  const earlier = input.recent.slice(0, -1)

  const topicCriteria: Record<string, string> = Object.fromEntries(catalog.topics.map((c) => [c.id, c.hint]))
  topicCriteria.none = NONE_TOPIC
  const personCriteria: Record<string, string> = Object.fromEntries(catalog.people.map((p) => [p.id, p.hint]))
  personCriteria.none = NONE_PERSON

  const company = catalog.company ? ` at ${catalog.company}` : ''
  const state = {
    context:
      mode === 'command'
        ? `Live transcript of a Polish company board meeting${company}. Someone just addressed the meeting assistant "Bolek" by name; latest_utterance is their request with the name removed. Speech is in Polish; company records and entity names are in English.`
        : `Live transcript of a Polish company board meeting${company}. Speech is in Polish; company records and entity names are in English. The assistant may show one knowledge card on the meeting screen.`,
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
      instructions: 'Which listed person is latest_utterance about? Match first names, surnames and Polish declensions (Karola, Tomaszem, Ewę). Choose none when no listed person is meant.',
      criteria: personCriteria,
    },
    topic: {
      type: 'choice' as const,
      instructions:
        'Which company entity is latest_utterance about? Polish speech names them in declined forms ("Pipedrive\'a", "e-Doręczeń", "ConnectorCo"). Choose the product or organization whenever the request is about it: its cost, invoices, who approved or owns it, its status, history or options. Choose a decision only when the request names that specific request, add-on or choice rather than the product. Choose a metric only when the request names the metric itself. Use earlier_turns only to resolve follow-ups such as "and who approved it?". Choose none when no listed entity fits.',
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
    ...(input.trayItems?.length
      ? {
          open_target: {
            type: 'choice' as const,
            instructions: 'If latest_utterance asks to bring back or open something the assistant prepared earlier, which of these items is meant? Choose none if it is not such a request.',
            criteria: { ...Object.fromEntries(input.trayItems.slice(0, 20).map((t) => [t.id, t.title])), none: 'Not a request to open one of these.' } as Record<string, string>,
          },
        }
      : {}),
    ...(input.presentations?.length
      ? {
          presentation: {
            type: 'choice' as const,
            instructions: 'If latest_utterance asks to open or show a presentation / slides, which stored deck is meant? Match by topic words in the title. Choose none if it is not such a request or no deck fits.',
            criteria: { ...Object.fromEntries(input.presentations.slice(0, 30).map((p) => [p.id, p.title])), none: 'Not a request to open one of these presentations.' } as Record<string, string>,
          },
        }
      : {}),
  }

  return { state, questions }
}

type ChoiceAnswer = JevChoice

interface JevAnswers {
  needs_info: JevNoul
  asks_person: JevNoul
  person: ChoiceAnswer
  topic: ChoiceAnswer
  facet: ChoiceAnswer
  intent: ChoiceAnswer
  open_target?: ChoiceAnswer
  presentation?: ChoiceAnswer
}

async function withJev(input: RelevanceInput, t: JevTransport, started: number, catalog: GraphCatalog): Promise<RelevanceResult> {
  const mode: JudgeMode = input.mode ?? 'ambient'
  const { state, questions } = buildRequest(input, mode, catalog)
  const { answers, model } = await askJev<JevAnswers>(t, state, questions, 6000)

  const pick = (a: ChoiceAnswer, known: (id: string) => boolean) => {
    const id = a.choice !== 'none' && known(a.choice) ? a.choice : null
    const probabilities = { ...(a.probabilities ?? {}) }
    const probability = id ? (probabilities[id] ?? 0) : 0
    return { id, probabilities, probability, confidence: id ? (a.confidence ?? probability) : 0 }
  }
  const topic = pick(answers.topic, (id) => catalog.topics.some((c) => c.id === id))
  // "ile płacimy za Pipedrive", "kto to zatwierdzał?": Jev may pick the spend metric or the purchase decision. When the room named the
  // product (now or a turn ago) and did not name that decision itself ("a LeadBooster wzięliśmy?"), the product card is the richer answer.
  if (topic.id) {
    const latestText = fold(input.recent.at(-1)!.text)
    const recentText = fold(input.recent.map((t) => t.text).join(' '))
    try {
      const parent = parentTopic(openGraph(), topic.id)
      const entry = parent ? catalog.topics.find((c) => c.id === parent) : undefined
      const picked = catalog.topics.find((c) => c.id === topic.id)
      // Words of the pick that are not also the parent's name ("LeadBooster", not "Pipedrive"): were any of them said?
      const parentWords = entry ? entry.aliases.flatMap(tokens) : []
      const ownWords = picked ? picked.aliases.flatMap(tokens).filter((w) => w.length >= 4 && !parentWords.some((pw) => similar(pw, w))) : []
      const latestTokens = tokens(latestText)
      const pickedNamed = ownWords.some((w) => latestTokens.some((t) => similar(t, w)))
      if (entry && !pickedNamed && nameScore(entry.aliases, recentText, tokens(recentText)) >= 0.75) {
        topic.probabilities[entry.id] = Math.max(topic.probabilities[entry.id] ?? 0, topic.probability)
        topic.id = entry.id
      }
    } catch {
      /* graph unavailable: keep Jev's pick */
    }
  }
  const person = pick(answers.person, (id) => catalog.people.some((p) => p.id === id))
  const facet = (FACETS.includes(answers.facet.choice as Facet) ? answers.facet.choice : 'general') as Facet
  let intentId = (INTENTS.some((i) => i.id === answers.intent.choice) ? answers.intent.choice : 'ask') as Intent
  const openTarget = answers.open_target ? { id: answers.open_target.choice === 'none' ? null : answers.open_target.choice, confidence: answers.open_target.confidence ?? 0 } : undefined
  let presentation: RelevanceResult['presentation']
  if (answers.presentation) {
    const known = input.presentations?.find((p) => p.id === answers.presentation!.choice)
    // Jev picks the deck; the title matcher is the tie-breaker when it abstains.
    const byTitle = known ? undefined : matchDeck(input.recent.at(-1)!.text, input.presentations ?? [])
    presentation = { id: known?.id ?? byTitle?.id ?? null, confidence: known ? (answers.presentation.confidence ?? 0) : byTitle ? 0.5 : 0 }
  }
  // "Pokaż, co mamy na landingu" reads like a deck to Jev; without a matched deck or the word for one it is something to produce.
  if (intentId === 'ui_present' && !presentation?.id && !/prezentacj|slajd|deck/i.test(input.recent.at(-1)!.text)) intentId = 'produce'

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
    openTarget,
    presentation,
    ...decide(mode, scores, intentId),
  }
}

// ---------- offline fallback ----------

/** First match wins, so the order matters: "otwórz raport" is a tray command, "przygotuj raport" is a request. */
const INTENT_MARKERS: [Intent, string[]][] = [
  ['ui_present', ['prezentacj', 'slajd', 'deck']],
  ['ui_scroll_up', ['w górę', 'do góry', 'na górę', 'wyżej', 'w gore', 'do gory']],
  ['ui_scroll_down', ['w dół', 'na dół', 'niżej', 'w dol', 'na dol']],
  ['ui_open', ['otwórz', 'pokaż ten', 'pokaż tę', 'wróć do', 'co z tym']],
  ['produce', ['mail', 'napisz', 'dokument', 'wykres', 'raport', 'zrzut', 'landing', 'stron', 'memo']],
  ['ui_send', ['wyślij', 'wysyłaj', 'wysłać', 'wysylaj']],
  ['ui_background', ['do tła', 'odłóż', 'na później', 'wrócimy do tego', 'zostaw to']],
  ['ui_close', ['schowaj', 'zamknij', 'wystarczy', 'to wszystko', 'dzięki', 'dziękuję', 'dzieki']],
  ['person', ['kim jest', 'kto to jest', 'czym się zajmuje', 'nad czym pracuje', 'za co odpowiada']],
  ['ask_meeting', ['punkty', 'notatk', 'ustalil', 'ustaliliśmy', 'podsumuj', 'omawial', 'obiecał', 'ze spotkania', 'z tego spotkania', 'zadania z dzisiaj']],
  ['ask_web', ['kurs ', 'nbp', 'internec', 'w sieci', 'wygoogl', 'pogod', 'news', 'wiadomości ze świata', 'konkurenc']],
]

const QUESTION_MARKERS = ['?', 'ile ', 'kto ', 'kim ', 'kiedy', 'do kiedy', 'jak ', 'czy ', 'co z ', 'jakie ', 'który', 'która', 'gdzie', 'dlaczego', 'nad czym', 'za co']
const PERSON_MARKERS = ['kim jest', 'kto to', 'kto jest', 'czym się zajmuje', 'nad czym', 'pracuje', 'za co', 'odpowiada', 'co robi']

const FACET_MARKERS: [Facet, string[]][] = [
  ['cost', ['ile', 'koszt', 'płac', 'plac', 'cen', 'kwot', 'budżet', 'oszczędz', 'zł', 'eur', 'tysi', 'faktur', 'chciał']],
  ['owner', ['kto ', 'zatwierdz', 'odpowiada', 'właścic', 'prowadził', 'prowadzi', 'decyd']],
  ['deadline', ['kiedy', 'termin', 'do kiedy', 'data', 'dzień', 'tydz', 'kończy', 'deadline', 'listopad', 'grudni', 'start ']],
  ['status', ['jak wyszed', 'jak wyszł', 'wynik', 'status', 'gdzie jesteśmy', 'co z ', 'jak idzie', 'udało', 'w końcu']],
  ['history', ['wcześniej', 'ostatnio', 'wtedy', 'poprzedni', 'historia', 'dlaczego', 'wzięliśmy']],
  ['options', ['opcj', 'alternatyw', 'możemy', 'co jeśli', 'jeśli nie', 'zamiast', 'wybór']],
]

/** A name said mid-sentence that the graph does not know ("Marek", "ERP"): the room moved to a new subject, so earlier turns should not carry a topic over. */
function namesUnknown(raw: string, catalog: GraphCatalog): boolean {
  const known = new Set([...catalog.topics, ...catalog.people].flatMap((c) => c.aliases.flatMap((a) => tokens(a))))
  const words = raw.split(/\s+/)
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!
    const prev = words[i - 1]!
    if (!/^\p{Lu}/u.test(w) || /[.!?:]$/.test(prev)) continue
    const t = tokens(w)[0]
    if (t && !known.has(t) && ![...known].some((k) => similar(k, t))) return true
  }
  return false
}

const tokens = (s: string): string[] =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)

/** Polish declensions and English labels meet on a shared stem: "doręczeń" ~ "doręczenia", "partnerem" ~ "partner". */
const similar = (a: string, b: string): boolean => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5))

/**
 * How well an entity's names match the text: 1.5 when a whole name is said, else
 * the share of its name words that are, lifted when one of them is distinctive
 * (six letters or more, "e-Doręczeń" for "e-Doręczenia integration"); a short
 * generic word alone ("gmina") stays low.
 */
function nameScore(aliases: string[], text: string, textTokens: string[]): number {
  let best = 0
  for (const alias of aliases) {
    if (alias.length >= 4 && text.includes(alias)) return 1.5
    const words = tokens(alias)
    if (!words.length) continue
    const hit = (w: string) => textTokens.some((t) => similar(t, w))
    const matched = words.filter(hit)
    const distinctive = matched.some((w) => w.length >= 6)
    // Share of the name that was said, plus a bonus for a distinctive word; a whole name (1.5) beats a partial one (at most 1.0 + 0.5 only when every word hit).
    best = Math.max(best, matched.length / words.length + (distinctive ? 0.5 : 0))
  }
  return best
}

/** Only a clearly named entity carries over from earlier turns. */
const CARRY_OVER_MIN = 0.6

function catalogScores<T extends { id: string; aliases: string[] }>(items: T[], latest: string, earlier: string): Record<string, number> {
  const lt = tokens(latest)
  const et = tokens(earlier)
  const scores: Record<string, number> = {}
  for (const item of items) {
    const now = nameScore(item.aliases, latest, lt)
    const earlierScore = earlier ? nameScore(item.aliases, earlier, et) : 0
    const before = earlierScore >= CARRY_OVER_MIN ? earlierScore * 0.4 : 0
    scores[item.id] = Math.max(now, before)
  }
  return scores
}

/** Best entity and how clearly it beats the runner-up. */
function best(scores: Record<string, number>): { id: string | null; confidence: number; score: number } {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [id, score] = ranked[0] ?? ['', 0]
  const second = ranked[1]?.[1] ?? 0
  return { id: score > 0 ? id : null, confidence: score > 0 ? score / (score + second) : 0, score }
}

/** Keyword matcher used when Jev is unavailable. Same shape, no probabilities to speak of. */
export function fallback(input: RelevanceInput, elapsedMs: number, catalog: GraphCatalog = catalogOrEmpty()): RelevanceResult {
  const mode: JudgeMode = input.mode ?? 'ambient'
  const latestRaw = input.recent.at(-1)?.text ?? ''
  const latest = latestRaw.toLowerCase()
  const latestFolded = fold(latestRaw)
  const earlier =
    mode === 'ambient' && namesUnknown(latestRaw, catalog)
      ? ''
      : fold(
          input.recent
            .slice(-3, -1)
            .map((t) => t.text)
            .join(' '),
        )

  // Follow-ups ("and who approved it?") lean on the last two turns; people only match on the current line.
  const topicScores = catalogScores(catalog.topics, latestFolded, earlier)
  const personScores = catalogScores(catalog.people, latestFolded, '')
  const topic = best(topicScores)
  const topicInLine = best(catalogScores(catalog.topics, latestFolded, '')).score > 0
  const person = best(personScores)

  const asks = mode === 'command' || QUESTION_MARKERS.some((m) => latest.includes(m))
  const needsInfo = asks ? 0.9 : 0.1
  // A full name said out loud is about that person unless a topic is named in the same breath.
  const asksPerson = (person.score >= 1 && !topicInLine) || PERSON_MARKERS.some((m) => latest.includes(m)) ? 0.9 : person.score > 0 && topic.score === 0 ? 0.7 : 0.1

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
    // Unaddressed talk names colleagues all the time ("Piotr, co z hostingiem?"); only a full name is a lookup there.
    personConfidence: mode === 'ambient' && person.score < 1 ? 0 : person.confidence,
    asksPerson,
  }

  let intent: Intent | null = null
  for (const [id, markers] of INTENT_MARKERS) {
    if (markers.some((m) => latest.includes(m))) {
      intent = id
      break
    }
  }
  const topicKnown = Boolean(topic.id) && topic.confidence >= COMMAND_MIN_CONFIDENCE
  if (!intent) {
    // A person named in this line beats a topic carried over from earlier turns.
    if (person.id && asksPerson >= 0.7 && !topicInLine) intent = 'person'
    else if (topicKnown) intent = 'ask_company'
    else if (person.id && asksPerson >= 0.7) intent = 'person'
    else intent = 'ask'
  }
  if (intent === 'person' && !person.id) intent = topicKnown ? 'ask_company' : 'ask'

  let presentation: RelevanceResult['presentation']
  if (input.presentations?.length) {
    const hit = matchDeck(latest, input.presentations)
    presentation = { id: hit?.id ?? null, confidence: hit ? 0.7 : 0 }
  }

  let openTarget: RelevanceResult['openTarget']
  if (input.trayItems?.length) {
    const hit = input.trayItems.find((t) => t.title.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((w) => w.length > 3 && latest.includes(w)))
    openTarget = { id: hit?.id ?? null, confidence: hit ? 0.7 : 0 }
  }

  return {
    engine: 'fallback',
    latencyMs: Math.round(elapsedMs),
    mode,
    needsInfo,
    topic: { id: topic.id, confidence: topic.confidence, probabilities: topicScores },
    person: { id: person.id, confidence: person.confidence },
    facet: { id: facet, confidence: facetHits > 0 ? 0.8 : 0.3 },
    intent: { id: intent, confidence: 0.6 },
    openTarget,
    presentation,
    ...decide(mode, scores, intent),
  }
}
