import { Link, createFileRoute } from '@tanstack/react-router'
import { BugIcon, EarIcon, LayoutGridIcon, MicIcon, MicOffIcon, PauseIcon, PlayIcon, RotateCcwIcon, SendIcon, SkipForwardIcon, SparklesIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'

import { ORB_COLORS } from '@/routes/app/index'
import { AnswerCardView, type AnswerEntry } from '@/components/meeting/answer-card'
import { KnowledgeCardView } from '@/components/meeting/knowledge-card'
import { PersonCardView } from '@/components/meeting/person-card'
import { TranscriptRail, expectedId, shownId, type Utterance } from '@/components/meeting/transcript-rail'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatDuration } from '@/demo/format'
import { FACET_LABEL, SCENARIOS, cardById, type Facet, type ListeningMode } from '@/demo/knowledge'
import { personCardById } from '@/demo/people'
import { PEOPLE } from '@/demo/seed'
import { useTranscription } from '@/lib/transcription'
import { cn } from '@/lib/utils'
import { ASSISTANT_NAME, isDismissal, matchWake } from '@/lib/wake-word'
import type { OrbState } from '@/registry/lib/orb-state'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'
import { askGraph, judgeUtterance, type GraphAnswer, type RelevanceResult } from '@/server/meeting-assist'

export const Route = createFileRoute('/meeting')({
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME} · Spotkanie na żywo` }] }),
  component: MeetingScreen,
})

/** What is on screen: a topic card, a person, or an open answer keyed by the utterance that asked. */
interface Shown {
  kind: 'card' | 'person' | 'answer'
  id: string
  facet: Facet
  utteranceId: string
  seq: number
}

interface MeetingState {
  utterances: Utterance[]
  current: Shown | null
  /** What was on screen, latest first, one entry per target. */
  history: Shown[]
  /** Open answers from the graph, keyed by utterance id. */
  answers: Record<string, AnswerEntry>
  seq: number
  /** Someone said only the name: the next utterance is the request. */
  armed: boolean
  /** Requests in flight; the orb thinks while any are pending. */
  thinking: number
}

type MeetingAction =
  | { type: 'say'; utterance: Utterance }
  | { type: 'ask'; utteranceId: string; question: string; seq: number }
  | { type: 'answered'; utteranceId: string; answer: GraphAnswer }
  | { type: 'answerFailed'; utteranceId: string; error: string }
  | { type: 'judged'; utteranceId: string; seq: number; result: RelevanceResult }
  | { type: 'pin'; kind: 'card' | 'person'; id: string; facet?: Facet }
  | { type: 'arm'; armed: boolean }
  | { type: 'dismiss' }
  | { type: 'reset' }

const EMPTY: MeetingState = { utterances: [], current: null, history: [], answers: {}, seq: 0, armed: false, thinking: 0 }

const sameTarget = (a: Shown, b: Shown) => a.kind === b.kind && a.id === b.id && (a.kind !== 'card' || a.facet === b.facet)

function pushHistory(history: Shown[], next: Shown): Shown[] {
  return [next, ...history.filter((h) => !sameTarget(h, next))].slice(0, 8)
}

function reducer(state: MeetingState, action: MeetingAction): MeetingState {
  switch (action.type) {
    case 'say': {
      const pending = !action.utterance.skipped
      return { ...state, utterances: [...state.utterances, { ...action.utterance, pending }].slice(-60), thinking: state.thinking + (pending ? 1 : 0) }
    }
    case 'ask': {
      // An open question: the answer card appears at once and fills in when the graph replies.
      const current: Shown = { kind: 'answer', id: action.utteranceId, facet: 'general', utteranceId: action.utteranceId, seq: action.seq }
      return {
        ...state,
        current,
        history: pushHistory(state.history, current),
        answers: { ...state.answers, [action.utteranceId]: { status: 'loading', question: action.question } },
        thinking: state.thinking + 1,
      }
    }
    case 'answered': {
      return {
        ...state,
        answers: { ...state.answers, [action.utteranceId]: { status: 'done', answer: action.answer } },
        thinking: Math.max(0, state.thinking - 1),
      }
    }
    case 'answerFailed': {
      const previous = state.answers[action.utteranceId]
      const question = previous && previous.status !== 'done' ? previous.question : ''
      return {
        ...state,
        answers: { ...state.answers, [action.utteranceId]: { status: 'error', question, error: action.error } },
        thinking: Math.max(0, state.thinking - 1),
      }
    }
    case 'judged': {
      const utterances = state.utterances.map((u) => (u.id === action.utteranceId ? { ...u, pending: false, result: action.result } : u))
      const r = action.result
      let { current, history } = state
      const id = shownId(r)
      if (r.action === 'show' && id && r.target === 'person' && action.seq >= (current?.seq ?? -1)) {
        // A person beats the open answer: the profile card is the better screen for "who is X".
        current = { kind: 'person', id, facet: 'general', utteranceId: action.utteranceId, seq: action.seq }
        history = pushHistory(history.filter((h) => !(h.kind === 'answer' && h.id === action.utteranceId)), current)
      } else if (r.mode === 'ambient' && r.action === 'show' && id && r.target && action.seq > (current?.seq ?? -1)) {
        // Ambient mode only: topic cards surface on their own. When addressed, the graph answer is the single source of truth.
        current = { kind: r.target, id, facet: r.facet.id, utteranceId: action.utteranceId, seq: action.seq }
        history = pushHistory(history, current)
      }
      return { ...state, utterances, current, history, thinking: Math.max(0, state.thinking - 1) }
    }
    case 'pin': {
      const seq = state.seq + 1
      const current: Shown = { kind: action.kind, id: action.id, facet: action.facet ?? 'general', utteranceId: '', seq }
      return { ...state, seq, current, history: pushHistory(state.history, current) }
    }
    case 'arm':
      return { ...state, armed: action.armed }
    case 'dismiss':
      return { ...state, current: null, armed: false }
    case 'reset':
      return EMPTY
  }
}

const speakerLabel = (personId: string): string => {
  const p = PEOPLE.find((x) => x.id === personId)
  return p ? `${p.name.split(' ')[0]} · ${p.role}` : personId
}

/** Reading pace for scripted playback. */
const lineDelay = (text: string): number => Math.min(5200, 1500 + text.length * 38)

const EMPTY_RESULT = (mode: RelevanceResult['mode'], error?: string): RelevanceResult => ({
  engine: 'fallback',
  latencyMs: 0,
  mode,
  needsInfo: 0,
  topic: { id: null, confidence: 0, probabilities: {} },
  person: { id: null, confidence: 0 },
  facet: { id: 'general', confidence: 0 },
  action: 'none',
  target: null,
  error,
})

function MeetingScreen() {
  const [state, dispatch] = useReducer(reducer, EMPTY)
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.id)
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!, [scenarioId])
  const [mode, setMode] = useState<ListeningMode>(scenario.mode)
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [debug, setDebug] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [typed, setTyped] = useState('')
  const seq = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const meetingInfo = useMemo(
    () => ({ title: scenario.title, goal: scenario.goal, participants: scenario.participantIds.map(speakerLabel) }),
    [scenario],
  )

  const say = useCallback(
    (speaker: string, text: string, expect?: Utterance['expect']) => {
      const id = `u-${Date.now().toString(36)}-${seq.current}`
      const mySeq = ++seq.current
      setStartedAt((s) => s ?? Date.now())
      const base: Utterance = { id, speaker, text, at: Date.now(), expect }

      const wake = matchWake(text)
      const armed = stateRef.current.armed
      const addressed = wake.addressed || armed
      if (wake.addressed && wake.bare) {
        // The name on its own: wait for the request.
        dispatch({ type: 'say', utterance: { ...base, addressed: true, skipped: true } })
        dispatch({ type: 'arm', armed: true })
        return
      }
      if (armed) dispatch({ type: 'arm', armed: false })

      const command = wake.addressed ? wake.command || text : text
      if (addressed && isDismissal(command)) {
        // "Bolek, dzięki": hide the card, orb returns to the centre. No model call.
        dispatch({ type: 'say', utterance: { ...base, addressed: true, skipped: true, dismissed: true } })
        dispatch({ type: 'dismiss' })
        return
      }

      if (mode === 'wake' && !addressed) {
        dispatch({ type: 'say', utterance: { ...base, skipped: true } })
        return
      }

      dispatch({ type: 'say', utterance: { ...base, addressed } })
      const judgeMode = addressed ? 'command' : 'ambient'
      const earlier = stateRef.current.utterances.slice(-5).map((u) => ({ speaker: u.speaker, text: u.text }))
      const recent = [...earlier, { speaker, text: command }]

      // Jev: is this about a known person or topic card, and from which angle?
      judgeUtterance({ data: { meeting: meetingInfo, recent, mode: judgeMode } })
        .then((result) => dispatch({ type: 'judged', utteranceId: id, seq: mySeq, result }))
        .catch((err: unknown) => dispatch({ type: 'judged', utteranceId: id, seq: mySeq, result: EMPTY_RESULT(judgeMode, err instanceof Error ? err.message : String(err)) }))

      // Addressed directly: also ask the whole company graph, in parallel.
      if (addressed) {
        dispatch({ type: 'ask', utteranceId: id, question: command, seq: mySeq })
        askGraph({ data: { question: command, recent: earlier.map((t) => `${t.speaker}: ${t.text}`) } })
          .then((answer) => dispatch({ type: 'answered', utteranceId: id, answer }))
          .catch((err: unknown) => dispatch({ type: 'answerFailed', utteranceId: id, error: err instanceof Error ? err.message : String(err) }))
      }
    },
    [meetingInfo, mode],
  )

  const speech = useTranscription((text) => say('Mikrofon', text))
  const listening = speech.listening

  const stepScenario = useCallback(() => {
    const line = scenario.lines[cursor]
    if (!line) {
      setPlaying(false)
      return
    }
    say(speakerLabel(line.speakerId), line.text, line.expect)
    setCursor((c) => c + 1)
  }, [scenario, cursor, say])

  useEffect(() => {
    if (!playing) return
    const line = scenario.lines[cursor]
    if (!line) {
      setPlaying(false)
      return
    }
    const previous = scenario.lines[cursor - 1]
    const id = window.setTimeout(stepScenario, previous ? lineDelay(previous.text) : 600)
    return () => window.clearTimeout(id)
  }, [playing, cursor, scenario, stepScenario])

  useEffect(() => {
    if (startedAt === null) return
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [startedAt])

  const reset = useCallback(() => {
    speech.stop()
    setPlaying(false)
    setCursor(0)
    setStartedAt(null)
    setElapsed(0)
    dispatch({ type: 'reset' })
  }, [speech])

  const changeScenario = (id: string) => {
    reset()
    setScenarioId(id)
    const next = SCENARIOS.find((s) => s.id === id)
    if (next) setMode(next.mode)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      if (e.code === 'Space') {
        e.preventDefault()
        stepScenario()
      } else if (e.key === 'Escape') {
        dispatch({ type: 'dismiss' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepScenario])

  const submitTyped = (e: FormEvent) => {
    e.preventDefault()
    const text = typed.trim()
    if (!text) return
    say('Sala', text)
    setTyped('')
  }

  const last = state.utterances.at(-1)
  const lastResult = [...state.utterances].reverse().find((u) => u.result)?.result
  const scriptDone = cursor >= scenario.lines.length
  const currentCard = state.current?.kind === 'card' ? cardById(state.current.id) : undefined
  const currentPerson = state.current?.kind === 'person' ? personCardById(state.current.id) : undefined
  const currentAnswer = state.current?.kind === 'answer' ? state.answers[state.current.id] : undefined
  const showing = Boolean(state.current && (currentCard || currentPerson || currentAnswer))
  const trigger = state.current ? state.utterances.find((u) => u.id === state.current!.utteranceId) : undefined
  const triggeredBy = trigger ? { speaker: trigger.speaker, text: trigger.text } : undefined
  const checks = state.utterances.filter((u) => u.expect !== undefined && (u.result || u.skipped))
  const passed = checks.filter((u) => expectedId(u) === shownId(u.result)).length
  const live = listening || playing
  const openCard = (cardId: string, facet?: Facet) => dispatch({ type: 'pin', kind: 'card', id: cardId, facet })

  const orbState: OrbState = state.thinking > 0 ? 'thinking' : state.armed ? 'speaking' : live ? 'listening' : 'idle'
  const status = state.thinking > 0 ? 'Sprawdzam' : state.armed ? `${ASSISTANT_NAME} słucha` : live ? (mode === 'wake' ? `Czekam na „${ASSISTANT_NAME}”` : 'Słucham') : 'Gotowy'

  const historyLabel = (h: Shown): string | null => {
    if (h.kind === 'person') return personCardById(h.id)?.name ?? null
    if (h.kind === 'card') return cardById(h.id) ? `${cardById(h.id)!.title} · ${FACET_LABEL[h.facet]}` : null
    const a = state.answers[h.id]
    if (!a) return null
    const q = a.status === 'done' ? a.answer.headline || a.answer.question : a.question
    return q.length > 40 ? `${q.slice(0, 38)}…` : q
  }

  return (
    <div className="app-theme flex h-svh flex-col overflow-hidden bg-background text-foreground antialiased">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4">
        <Link to="/context" className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <span aria-hidden className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            B
          </span>
          <span className="text-sm font-semibold tracking-tight">{ASSISTANT_NAME}</span>
        </Link>
        <span aria-hidden className="h-5 w-px bg-border" />
        <NativeSelect size="sm" aria-label="Scenariusz" value={scenarioId} onChange={(e) => changeScenario(e.target.value)}>
          {SCENARIOS.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {s.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button size="icon-sm" variant={playing ? 'secondary' : 'ghost'} disabled={scriptDone} onClick={() => setPlaying((p) => !p)} title={playing ? 'Pauza' : 'Odtwarzaj scenariusz'}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button size="icon-sm" variant="ghost" disabled={scriptDone} onClick={stepScenario} title="Następna linia (Spacja)">
          <SkipForwardIcon />
        </Button>
        <Button
          size="sm"
          variant={listening ? 'destructive' : 'outline'}
          disabled={speech.status === 'unsupported'}
          title={speech.status === 'unsupported' ? 'Przeglądarka nie obsługuje rozpoznawania mowy (użyj Chrome).' : 'Grok Voice Transcribe przez lokalne proxy; bez proxy rozpoznawanie w przeglądarce'}
          onClick={() => (listening ? speech.stop() : void speech.start())}
        >
          {listening ? <MicOffIcon /> : <MicIcon />}
          {speech.status === 'connecting' ? 'Łączę…' : listening ? 'Stop' : 'Mikrofon'}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={reset} title="Od nowa">
          <RotateCcwIcon />
        </Button>
        <span className="min-w-0 flex-1 truncate pl-2 text-xs text-muted-foreground">
          {!scriptDone && `Linia ${cursor} z ${scenario.lines.length} · `}
          <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
          {speech.engine && listening && ` · ${speech.engine === 'grok' ? 'Grok Voice Transcribe' : 'mikrofon przeglądarki'}`}
          {speech.error && <span className="text-destructive"> · {speech.error}</span>}
          {debug && checks.length > 0 && (
            <span className="font-mono">
              {' '}
              · test {passed}/{checks.length}
            </span>
          )}
        </span>
        <ModeToggle mode={mode} onChange={setMode} />
        <EngineBadge result={lastResult} />
        <Button variant={debug ? 'secondary' : 'ghost'} size="icon-sm" aria-pressed={debug} title="Transkrypcja i diagnostyka" onClick={() => setDebug((d) => !d)}>
          <BugIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link to="/context" />} title="Workspace">
          <LayoutGridIcon />
        </Button>
      </header>

      <main className="relative min-h-0 flex-1">
        {/* The orb: centre stage when idle, docked at the top while something is shown. */}
        <div
          aria-hidden={showing}
          className={cn(
            'pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-6 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            showing ? 'top-3' : 'top-1/2 -translate-y-1/2',
          )}
        >
          <NebulaOrb
            state={orbState}
            size={showing ? 44 : 220}
            colorFrom={ORB_COLORS.from}
            colorTo={ORB_COLORS.to}
            label={status}
            className="transition-[width,height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          />
          <div className={cn('flex flex-col items-center gap-2 text-center transition-opacity duration-300', showing ? 'opacity-0' : 'opacity-100 delay-200')}>
            <p className={cn('text-xs font-medium tracking-[0.18em] uppercase', state.armed ? 'text-primary' : 'text-muted-foreground')}>{status}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">{state.armed ? 'O co chodzi?' : scenario.title}</h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {state.armed
                ? 'Zapytaj o osobę, koszt, właściciela, termin, wynik albo cokolwiek z danych firmy.'
                : mode === 'wake'
                  ? `Powiedz „${ASSISTANT_NAME}, ile zapłaciliśmy za Pipedrive w sierpniu?”. Skończ „${ASSISTANT_NAME}, dzięki”.`
                  : scenario.goal}
            </p>
          </div>
        </div>

        {showing && state.current && (
          <div key={`${state.current.kind}-${state.current.id}-${state.current.facet}-${state.current.seq}`} className="absolute inset-0 overflow-y-auto px-6 pt-16 pb-8 md:px-10">
            <div className="mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 fill-mode-both">
              <div className="mb-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'dismiss' })} title={`Albo powiedz „${ASSISTANT_NAME}, dzięki”`}>
                  <XIcon /> Schowaj
                </Button>
              </div>
              {currentCard && <KnowledgeCardView card={currentCard} facet={state.current.facet} triggeredBy={triggeredBy} />}
              {currentPerson && <PersonCardView person={currentPerson} triggeredBy={triggeredBy} onOpenCard={(id) => openCard(id)} />}
              {currentAnswer && (
                <AnswerCardView entry={currentAnswer} triggeredBy={triggeredBy} debug={debug} />
              )}
            </div>
          </div>
        )}

        {debug && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-[22rem] flex-col border-l border-border bg-sidebar/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium">
              <span>Transkrypcja · diagnostyka</span>
              <Button size="icon-xs" variant="ghost" onClick={() => setDebug(false)} aria-label="Zamknij">
                <XIcon />
              </Button>
            </div>
            {state.history.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
                {state.history.map((h) => {
                  const label = historyLabel(h)
                  if (!label) return null
                  const active = state.current ? sameTarget(state.current, h) : false
                  return (
                    <Button
                      key={`${h.kind}-${h.id}-${h.facet}`}
                      size="xs"
                      variant={active ? 'secondary' : 'outline'}
                      onClick={() => (h.kind === 'answer' ? dispatch({ type: 'ask', utteranceId: h.id, question: '', seq: h.seq }) : dispatch({ type: 'pin', kind: h.kind, id: h.id, facet: h.facet }))}
                      disabled={h.kind === 'answer'}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              <TranscriptRail utterances={state.utterances} interim={speech.interim} debug />
            </div>
          </aside>
        )}
      </main>

      {/* One caption line: what was said last, and what is being heard now. */}
      <footer className="flex h-14 shrink-0 items-center gap-4 border-t border-border/60 px-6">
        <div className="flex min-w-0 flex-1 items-baseline gap-3" aria-live="polite">
          {speech.interim ? (
            <>
              <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Słyszę</span>
              <span className="truncate text-base text-muted-foreground">{speech.interim}</span>
            </>
          ) : last ? (
            <>
              <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{last.speaker}</span>
              <span className={cn('truncate text-base', last.addressed ? 'text-foreground' : 'text-foreground/70')}>{last.text}</span>
              {last.addressed && <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">do {ASSISTANT_NAME}</span>}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Ostatnia wypowiedź pojawi się tutaj.</span>
          )}
        </div>
        <form onSubmit={submitTyped} className="flex shrink-0 items-center gap-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`${ASSISTANT_NAME}, ile…`}
            aria-label="Wypowiedź"
            className="h-8 w-64 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="submit" size="icon-sm" variant="ghost" disabled={!typed.trim()} aria-label="Wyślij">
            <SendIcon />
          </Button>
        </form>
      </footer>
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: ListeningMode; onChange: (m: ListeningMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Tryb słuchania" className="hidden items-center rounded-lg border border-border p-0.5 md:flex">
      {(
        [
          ['wake', SparklesIcon, 'Na imię'],
          ['ambient', EarIcon, 'Zawsze'],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

function EngineBadge({ result }: { result: RelevanceResult | undefined }) {
  if (!result) return null
  const jev = result.engine === 'jev'
  return (
    <span
      className={cn('hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium lg:inline-flex', jev ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}
      title={result.error ?? (jev ? `TypeSafe ${result.model ?? 'jev'} przez ${result.via}` : 'Brak klucza — dopasowanie słów kluczowych')}
    >
      <span className={cn('size-1.5 rounded-full', jev ? 'bg-primary' : 'bg-muted-foreground')} aria-hidden />
      {jev ? `Jev · ${result.latencyMs} ms` : 'Tryb offline'}
    </span>
  )
}
