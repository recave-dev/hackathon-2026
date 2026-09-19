import { Link, createFileRoute } from '@tanstack/react-router'
import { BugIcon, LayoutGridIcon, MicIcon, MicOffIcon, PauseIcon, PlayIcon, RotateCcwIcon, SendIcon, SkipForwardIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'

import { ORB_COLORS } from '@/routes/app/index'
import { initials } from '@/components/desktop/page'
import { KnowledgeCardView } from '@/components/meeting/knowledge-card'
import { TranscriptRail, type Utterance } from '@/components/meeting/transcript-rail'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatDuration } from '@/demo/format'
import { FACET_LABEL, KNOWLEDGE_CARDS, SCENARIOS, cardById, type Facet, type Scenario } from '@/demo/knowledge'
import { PEOPLE } from '@/demo/seed'
import { useSpeechRecognition } from '@/lib/speech'
import { cn } from '@/lib/utils'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'
import { judgeUtterance, type RelevanceResult } from '@/server/meeting-assist'

export const Route = createFileRoute('/meeting')({
  head: () => ({ meta: [{ title: 'Droker · Spotkanie na żywo' }] }),
  component: MeetingScreen,
})

interface Shown {
  cardId: string
  facet: Facet
  utteranceId: string
  seq: number
}

interface MeetingState {
  utterances: Utterance[]
  current: Shown | null
  /** Cards that were on screen, latest first, one entry per card+facet. */
  history: Shown[]
  /** Cards mentioned in passing but not asked about. */
  mentions: string[]
  seq: number
}

type MeetingAction =
  | { type: 'say'; utterance: Utterance }
  | { type: 'judged'; utteranceId: string; seq: number; result: RelevanceResult }
  | { type: 'pin'; cardId: string; facet: Facet }
  | { type: 'dismiss' }
  | { type: 'reset' }

const EMPTY: MeetingState = { utterances: [], current: null, history: [], mentions: [], seq: 0 }

function reducer(state: MeetingState, action: MeetingAction): MeetingState {
  switch (action.type) {
    case 'say':
      return { ...state, utterances: [...state.utterances, { ...action.utterance, pending: true }] }
    case 'judged': {
      const utterances = state.utterances.map((u) => (u.id === action.utteranceId ? { ...u, pending: false, result: action.result } : u))
      const r = action.result
      let { current, history, mentions } = state
      if (r.action === 'show' && r.topic.id && action.seq > (current?.seq ?? -1)) {
        current = { cardId: r.topic.id, facet: r.facet.id, utteranceId: action.utteranceId, seq: action.seq }
        history = [current, ...history.filter((h) => !(h.cardId === current!.cardId && h.facet === current!.facet))].slice(0, 8)
        mentions = mentions.filter((m) => m !== r.topic.id)
      } else if (r.action === 'mention' && r.topic.id && r.topic.id !== current?.cardId && !mentions.includes(r.topic.id)) {
        mentions = [r.topic.id, ...mentions].slice(0, 4)
      }
      return { ...state, utterances, current, history, mentions }
    }
    case 'pin': {
      const seq = state.seq + 1
      const current: Shown = { cardId: action.cardId, facet: action.facet, utteranceId: '', seq }
      return {
        ...state,
        seq,
        current,
        history: [current, ...state.history.filter((h) => !(h.cardId === action.cardId && h.facet === action.facet))].slice(0, 8),
        mentions: state.mentions.filter((m) => m !== action.cardId),
      }
    }
    case 'dismiss':
      return { ...state, current: null }
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

function MeetingScreen() {
  const [state, dispatch] = useReducer(reducer, EMPTY)
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.id)
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!, [scenarioId])
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [debug, setDebug] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [typed, setTyped] = useState('')
  const seq = useRef(0)
  const utterancesRef = useRef(state.utterances)
  utterancesRef.current = state.utterances

  const meetingInfo = useMemo(
    () => ({
      title: scenario.title,
      goal: scenario.goal,
      participants: scenario.participantIds.map(speakerLabel),
    }),
    [scenario],
  )

  const say = useCallback(
    (speaker: string, text: string, expect?: Utterance['expect']) => {
      const id = `u-${Date.now().toString(36)}-${seq.current}`
      const mySeq = ++seq.current
      dispatch({ type: 'say', utterance: { id, speaker, text, at: Date.now(), expect } })
      setStartedAt((s) => s ?? Date.now())
      const recent = [...utterancesRef.current.slice(-5), { speaker, text }].map((u) => ({ speaker: u.speaker, text: u.text }))
      judgeUtterance({ data: { meeting: meetingInfo, recent } })
        .then((result) => dispatch({ type: 'judged', utteranceId: id, seq: mySeq, result }))
        .catch((err: unknown) => {
          const result: RelevanceResult = {
            engine: 'fallback',
            latencyMs: 0,
            needsInfo: 0,
            topic: { id: null, confidence: 0, probabilities: {} },
            facet: { id: 'general', confidence: 0 },
            action: 'none',
            error: err instanceof Error ? err.message : String(err),
          }
          dispatch({ type: 'judged', utteranceId: id, seq: mySeq, result })
        })
    },
    [meetingInfo],
  )

  const speech = useSpeechRecognition((text) => say('Mikrofon', text))
  const listening = speech.status === 'listening'

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

  const last = [...state.utterances].reverse().find((u) => u.result)?.result
  const scriptDone = cursor >= scenario.lines.length
  const currentCard = cardById(state.current?.cardId)
  const trigger = state.current ? state.utterances.find((u) => u.id === state.current!.utteranceId) : undefined
  const checks = state.utterances.filter((u) => u.expect !== undefined && u.result)
  const passed = checks.filter((u) => (u.expect?.card ?? null) === (u.result!.action === 'show' ? u.result!.topic.id : null)).length

  return (
    <div className="app-theme flex h-svh flex-col bg-background text-foreground antialiased">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4 md:px-6">
        <Link to="/context" className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            D
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-semibold tracking-tight">Droker Live</span>
            <span className="text-[11px] text-muted-foreground">Asystent spotkania</span>
          </span>
        </Link>
        <span aria-hidden className="h-6 w-px bg-border" />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={cn('size-2 shrink-0 rounded-full', listening || playing ? 'animate-pulse bg-destructive' : 'bg-muted-foreground/40')} aria-hidden />
          <span className="truncate text-sm font-medium">{scenario.title}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatDuration(elapsed)}</span>
        </div>
        <EngineBadge result={last} />
        <Button variant={debug ? 'secondary' : 'ghost'} size="icon-sm" aria-pressed={debug} title="Panel diagnostyczny" onClick={() => setDebug((d) => !d)}>
          <BugIcon />
        </Button>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/context" />}>
          <LayoutGridIcon /> Workspace
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[21rem] shrink-0 flex-col border-r border-border bg-sidebar">
          <div className="flex flex-col gap-2.5 border-b border-border px-3 py-3">
            <NativeSelect size="sm" className="w-full" aria-label="Scenariusz" value={scenarioId} onChange={(e) => changeScenario(e.target.value)}>
              {SCENARIOS.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant={playing ? 'secondary' : 'default'} disabled={scriptDone} onClick={() => setPlaying((p) => !p)}>
                {playing ? <PauseIcon /> : <PlayIcon />}
                {playing ? 'Pauza' : 'Odtwarzaj'}
              </Button>
              <Button size="sm" variant="outline" disabled={scriptDone} onClick={stepScenario} title="Spacja">
                <SkipForwardIcon /> Następna
              </Button>
              <Button
                size="sm"
                variant={listening ? 'destructive' : 'outline'}
                disabled={speech.status === 'unsupported'}
                title={speech.status === 'unsupported' ? 'Przeglądarka nie obsługuje rozpoznawania mowy (użyj Chrome).' : 'Rozpoznawanie mowy w przeglądarce, pl-PL'}
                onClick={() => (listening ? speech.stop() : speech.start())}
              >
                {listening ? <MicOffIcon /> : <MicIcon />}
                {listening ? 'Stop' : 'Mikrofon'}
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={reset} title="Od nowa">
                <RotateCcwIcon />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {scriptDone ? 'Koniec scenariusza.' : `Linia ${cursor} z ${scenario.lines.length}.`} <Kbd>Spacja</Kbd> następna, <Kbd>Esc</Kbd> chowa kartę.
              {speech.error && <span className="text-destructive"> Mikrofon: {speech.error}.</span>}
              {debug && checks.length > 0 && (
                <span className="font-mono">
                  {' '}
                  · test {passed}/{checks.length}
                </span>
              )}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <TranscriptRail utterances={state.utterances} interim={speech.interim} debug={debug} />
          </div>
          <form onSubmit={submitTyped} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Wpisz, co ktoś powiedział…"
              aria-label="Wypowiedź"
              className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" size="icon-sm" variant="outline" disabled={!typed.trim()} aria-label="Wyślij">
              <SendIcon />
            </Button>
          </form>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6 md:px-10">
          {currentCard && state.current ? (
            <div key={`${state.current.cardId}-${state.current.facet}-${state.current.seq}`} className="mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'dismiss' })}>
                  <XIcon /> Schowaj
                </Button>
              </div>
              <KnowledgeCardView card={currentCard} facet={state.current.facet} triggeredBy={trigger ? { speaker: trigger.speaker, text: trigger.text } : undefined} />
            </div>
          ) : (
            <IdleView scenario={scenario} live={listening || playing} onPick={(cardId) => dispatch({ type: 'pin', cardId, facet: 'general' })} />
          )}
        </main>
      </div>

      {(state.history.length > 0 || state.mentions.length > 0) && (
        <footer className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-t border-border px-4 md:px-6">
          {state.history.length > 0 && <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Pokazane</span>}
          {state.history.map((h) => {
            const card = cardById(h.cardId)
            if (!card) return null
            const active = state.current?.cardId === h.cardId && state.current.facet === h.facet
            return (
              <Button key={`${h.cardId}-${h.facet}`} size="xs" variant={active ? 'secondary' : 'outline'} onClick={() => dispatch({ type: 'pin', cardId: h.cardId, facet: h.facet })}>
                {card.title} · {FACET_LABEL[h.facet]}
              </Button>
            )
          })}
          {state.mentions.length > 0 && <span className="ml-3 shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Wspomniano</span>}
          {state.mentions.map((id) => {
            const card = cardById(id)
            if (!card) return null
            return (
              <Button key={id} size="xs" variant="ghost" onClick={() => dispatch({ type: 'pin', cardId: id, facet: 'general' })}>
                {card.title}
              </Button>
            )
          })}
        </footer>
      )}
    </div>
  )
}

function EngineBadge({ result }: { result: RelevanceResult | undefined }) {
  if (!result) return <span className="hidden text-xs text-muted-foreground sm:inline">Silnik: czeka na pierwszą wypowiedź</span>
  const jev = result.engine === 'jev'
  return (
    <span
      className={cn('hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium sm:inline-flex', jev ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}
      title={result.error ?? (jev ? `TypeSafe ${result.model ?? 'jev'}` : 'Brak TYPESAFE_API_KEY — dopasowanie słów kluczowych')}
    >
      <span className={cn('size-1.5 rounded-full', jev ? 'bg-primary' : 'bg-muted-foreground')} aria-hidden />
      {jev ? `Jev · ${result.latencyMs} ms` : 'Tryb offline'}
    </span>
  )
}

function IdleView({ scenario, live, onPick }: { scenario: Scenario; live: boolean; onPick: (cardId: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-8 text-center">
      <NebulaOrb state={live ? 'listening' : 'idle'} size={168} colorFrom={ORB_COLORS.from} colorTo={ORB_COLORS.to} label={live ? 'Słucham' : 'Gotowy'} />
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">{live ? 'Słucham' : 'Gotowy'}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{scenario.title}</h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">{scenario.goal}</p>
      </div>
      <div className="flex items-center gap-2">
        {scenario.participantIds.map((id) => {
          const p = PEOPLE.find((x) => x.id === id)
          if (!p) return null
          return (
            <span key={id} title={`${p.name} · ${p.role}`} className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initials(p.name)}
            </span>
          )
        })}
      </div>
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs text-muted-foreground">Gdy ktoś zapyta o koszt, właściciela, termin albo wynik, karta pojawi się tutaj. Tematy, które zna asystent:</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {KNOWLEDGE_CARDS.map((card) => (
            <Button key={card.id} size="xs" variant="outline" onClick={() => onPick(card.id)}>
              {card.title}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
