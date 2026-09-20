import { parseSlideNumber } from '../lib/slides.ts'
import { askJev, jevTransport, type JevChoice, type JevNoul } from './jev.ts'

/**
 * Server-only: focus mode. While something is in focus (for now: a
 * presentation) the room steers it by voice without saying the assistant's
 * name, so every utterance goes through one small, fast Jev call that decides
 * whether it is a steering command and which one. Same fallback idea as
 * relevance: a keyword matcher when Jev is unavailable.
 */

export type FocusKind = 'presentation'
export type FocusCommand = 'next' | 'prev' | 'first' | 'last' | 'goto' | 'close' | 'none'

export interface FocusInput {
  /** What was just said, name already stripped if it was addressed. */
  text: string
  focus: {
    kind: FocusKind
    title: string
    /** 1-based position of what is on screen. */
    position: number
    total: number
    /** Titles of the steps (slides), in order, so "pokaż slajd o budżecie" resolves. */
    itemTitles?: string[]
  }
}

export interface FocusResult {
  engine: 'jev' | 'fallback'
  model?: string
  latencyMs: number
  command: FocusCommand
  confidence: number
  /** For `goto`: 1-based target. */
  target?: number | null
  error?: string
}

const COMMAND_CRITERIA: Record<FocusCommand, string> = {
  next: 'Move to the next slide: "następny", "dalej", "kolejny", "next", "idziemy dalej", "przewiń".',
  prev: 'Go back one slide: "poprzedni", "wróć", "cofnij", "wstecz", "back", "jeszcze raz poprzedni".',
  first: 'Jump to the first slide or start over: "od początku", "pierwszy slajd", "na początek".',
  last: 'Jump to the last slide or the end: "ostatni slajd", "na koniec", "do końca", "podsumowanie" when it is the last slide.',
  goto: 'Jump to one specific slide named by number, ordinal or topic: "slajd trzeci", "pokaż slajd o budżecie", "przejdź do ryzyk", "wróć do harmonogramu".',
  close: 'Leave the presentation: "zamknij", "koniec prezentacji", "wyjdź z prezentacji", "schowaj", "dzięki, wystarczy".',
  none: 'Not a command for the presentation: someone discusses the content, asks a question, agrees, or talks about something else.',
}

const COMMANDS = Object.keys(COMMAND_CRITERIA) as FocusCommand[]

function buildRequest(input: FocusInput) {
  const f = input.focus
  const titles = (f.itemTitles ?? []).slice(0, 40)
  const state = {
    context:
      'Live transcript of a Polish company board meeting. A presentation is open on the meeting screen in focus mode: the room steers slides by voice without addressing the assistant by name. latest_utterance is what was just said; it may be a steering command or ordinary discussion. Speech is Polish.',
    presentation: {
      title: f.title,
      current_slide: f.position,
      total_slides: f.total,
      current_slide_title: titles[f.position - 1] ?? null,
      slides: titles.map((t, i) => `${i + 1}. ${t}`),
    },
    latest_utterance: input.text,
  }
  const questions = {
    is_command: {
      type: 'noul' as const,
      instructions: 'Is latest_utterance an instruction to control the presentation (move between slides, jump to a slide, close it) rather than a remark about its content or general conversation?',
      criteria: {
        true: 'A short imperative or request aimed at the slides: next, back, a slide number or topic, close.',
        false: 'Discussion, a question about the numbers, an opinion, an aside, or a request unrelated to the slides.',
      },
    },
    command: {
      type: 'choice' as const,
      instructions: 'Which presentation command is latest_utterance? Choose none when it is not a command.',
      criteria: COMMAND_CRITERIA as Record<string, string>,
    },
    ...(titles.length
      ? {
          target_slide: {
            type: 'choice' as const,
            instructions: 'If latest_utterance names one specific slide by its number or topic, which slide is meant? Choose none when it does not name one.',
            criteria: { ...Object.fromEntries(titles.map((t, i) => [`s${i + 1}`, `Slide ${i + 1}: ${t}`])), none: 'No specific slide is named.' } as Record<string, string>,
          },
        }
      : {}),
  }
  return { state, questions }
}

interface Answers {
  is_command: JevNoul
  command: JevChoice
  target_slide?: JevChoice
}

const IS_COMMAND_MIN = 0.4

export async function judgeFocusCommand(input: FocusInput): Promise<FocusResult> {
  const t = jevTransport()
  const started = performance.now()
  if (!t || !input.text.trim()) return focusFallback(input, 0)
  try {
    const { state, questions } = buildRequest(input)
    const { answers, model } = await askJev<Answers>(t, state, questions, 5000)
    const isCommand = answers.is_command.noul
    let command = (COMMANDS.includes(answers.command.choice as FocusCommand) ? answers.command.choice : 'none') as FocusCommand
    const confidence = answers.command.confidence ?? answers.command.probabilities?.[command] ?? 0
    if (isCommand < IS_COMMAND_MIN && command !== 'close') command = 'none'
    let target: number | null = null
    if (command === 'goto') {
      target = parseSlideNumber(input.text, input.focus.total)
      if (!target && answers.target_slide && answers.target_slide.choice !== 'none') target = Number(answers.target_slide.choice.slice(1)) || null
      if (!target) command = 'none'
    }
    return { engine: 'jev', model, latencyMs: Math.round(performance.now() - started), command, confidence, target }
  } catch (err) {
    const r = focusFallback(input, performance.now() - started)
    r.error = err instanceof Error ? err.message : String(err)
    return r
  }
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')

const CLOSE = /\b(zamknij|zamykamy|koniec prezentacji|wyjdz|wychodzimy|schowaj|wystarczy|zakoncz)/
const LAST = /\b(ostatni|na koniec|do konca|na sam koniec)/
const FIRST = /\b(od poczatku|na poczatek|od nowa|pierwszy slajd)/
const NEXT = /\b(nastepn|dalej|kolejn|next|do przodu|przewin|idziemy)/
const PREV = /\b(poprzedn|wroc|cofnij|wstecz|back|do tylu)/
const GOTO_WORDS = /\b(slajd|stron|przejdz|pokaz|przeskocz|numer)/

/** Keyword matcher used when Jev is unavailable. */
export function focusFallback(input: FocusInput, elapsedMs: number): FocusResult {
  const t = fold(input.text)
  const total = input.focus.total
  const base = { engine: 'fallback' as const, latencyMs: Math.round(elapsedMs), confidence: 0.7 }
  if (CLOSE.test(t)) return { ...base, command: 'close' }
  const number = parseSlideNumber(input.text, total)
  if (number && GOTO_WORDS.test(t)) return { ...base, command: 'goto', target: number }
  if (FIRST.test(t)) return { ...base, command: 'first' }
  if (LAST.test(t)) return { ...base, command: 'last' }
  if (NEXT.test(t)) return { ...base, command: 'next' }
  if (PREV.test(t)) return { ...base, command: 'prev' }
  // "przejdź do ryzyk": a slide named by topic.
  if (GOTO_WORDS.test(t) && input.focus.itemTitles?.length) {
    const words = t.split(/[^a-z0-9]+/).filter((w) => w.length >= 4)
    let bestIdx = -1
    let bestHits = 0
    input.focus.itemTitles.forEach((title, i) => {
      const tw = fold(title)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4)
      const hits = words.filter((w) => tw.some((x) => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))).length
      if (hits > bestHits) {
        bestHits = hits
        bestIdx = i
      }
    })
    if (bestIdx >= 0) return { ...base, command: 'goto', target: bestIdx + 1 }
  }
  return { ...base, command: 'none', confidence: 0.5 }
}
