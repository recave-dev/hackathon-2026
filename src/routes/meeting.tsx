import { Link, createFileRoute } from '@tanstack/react-router'
import { BugIcon, EarIcon, LayoutGridIcon, MicIcon, MicOffIcon, PauseIcon, PlayIcon, RotateCcwIcon, SendIcon, SkipForwardIcon, SparklesIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'

import { AnswerCardView, AnswerErrorView, AnswerLoadingView } from '@/components/meeting/answer-card'
import { KnowledgeCardView } from '@/components/meeting/knowledge-card'
import { NoteCardView } from '@/components/meeting/note-card'
import { PersonCardView } from '@/components/meeting/person-card'
import { ReportCardView } from '@/components/meeting/report-card'
import { TranscriptRail, expectedId, shownId, type Utterance } from '@/components/meeting/transcript-rail'
import { Tray, type TrayItem } from '@/components/meeting/tray'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatDuration } from '@/demo/format'
import { FACET_LABEL, SCENARIOS, cardById, type Facet, type ListeningMode } from '@/demo/knowledge'
import { personCardById } from '@/demo/people'
import { PEOPLE } from '@/demo/seed'
import { intentById, type Intent } from '@/lib/intents'
import { useTranscription } from '@/lib/transcription'
import { cn } from '@/lib/utils'
import { ASSISTANT_NAME, isDismissal, matchWake } from '@/lib/wake-word'
import type { OrbState } from '@/registry/lib/orb-state'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'
import { ORB_COLORS } from '@/routes/app/index'
import { getTask, judgeUtterance, runAction, type ActionResult, type RelevanceResult, type TaskResult, type TranscriptLine } from '@/server/meeting-assist'

export const Route = createFileRoute('/meeting')({
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME} · Spotkanie na żywo` }] }),
  component: MeetingScreen,
})

/** What is on screen: a topic card, a person, or the result of a request (keyed by the utterance that asked). */
interface Shown {
  kind: 'card' | 'person' | 'result'
  id: string
  facet: Facet
  utteranceId: string
  seq: number
}

type ResultEntry =
  | { status: 'loading'; question: string; intent?: Intent }
  | { status: 'done'; question: string; intent: Intent; result: ActionResult }
  | { status: 'error'; question: string; intent?: Intent; error: string }

interface MeetingState {
  utterances: Utterance[]
  current: Shown | null
  /** What was on screen, latest first, one entry per target. */
  history: Shown[]
  /** Results of addressed requests, keyed by utterance id. */
  results: Record<string, ResultEntry>
  /** Background tasks still running: task id → utterance id. */
  pendingTasks: Record<string, string>
  /** Finished background tasks the room has not looked at yet. */
  fresh: string[]
  seq: number
  /** Someone said only the name: the next utterance is the request. */
  armed: boolean
  /** Requests in flight; the orb thinks while any are pending. */
  thinking: number
}

type MeetingAction =
  | { type: 'say'; utterance: Utterance }
  | { type: 'ask'; utteranceId: string; question: string; seq: number }
  | { type: 'intent'; utteranceId: string; intent: Intent }
  | { type: 'resolved'; utteranceId: string; result: ActionResult }
  | { type: 'failed'; utteranceId: string; error: string }
  | { type: 'task'; task: TaskResult }
  | { type: 'judged'; utteranceId: string; seq: number; result: RelevanceResult }
  | { type: 'pin'; kind: 'card' | 'person'; id: string; facet?: Facet }
  | { type: 'show'; utteranceId: string }
  | { type: 'arm'; armed: boolean }
  | { type: 'dismiss' }
  | { type: 'restore'; state: Pick<MeetingState, 'utterances' | 'results' | 'history' | 'seq' | 'pendingTasks'> }
  | { type: 'reset' }

const EMPTY: MeetingState = { utterances: [], current: null, history: [], results: {}, pendingTasks: {}, fresh: [], seq: 0, armed: false, thinking: 0 }

const sameTarget = (a: Shown, b: Shown) => a.kind === b.kind && a.id === b.id && (a.kind !== 'card' || a.facet === b.facet)

function pushHistory(history: Shown[], next: Shown): Shown[] {
  return [next, ...history.filter((h) => !sameTarget(h, next))].slice(0, 10)
}

function reducer(state: MeetingState, action: MeetingAction): MeetingState {
  switch (action.type) {
    case 'say': {
      const pending = !action.utterance.skipped
      return { ...state, utterances: [...state.utterances, { ...action.utterance, pending }].slice(-200), thinking: state.thinking + (pending ? 1 : 0) }
    }
    case 'ask': {
      // The result card appears at once and fills in when the action lands.
      const current: Shown = { kind: 'result', id: action.utteranceId, facet: 'general', utteranceId: action.utteranceId, seq: action.seq }
      return { ...state, current, history: pushHistory(state.history, current), results: { ...state.results, [action.utteranceId]: { status: 'loading', question: action.question } }, thinking: state.thinking + 1 }
    }
    case 'intent': {
      const entry = state.results[action.utteranceId]
      if (!entry || entry.status !== 'loading') return state
      return { ...state, results: { ...state.results, [action.utteranceId]: { ...entry, intent: action.intent } } }
    }
    case 'resolved': {
      const entry = state.results[action.utteranceId]
      const question = entry?.question ?? action.result.question
      const results = { ...state.results, [action.utteranceId]: { status: 'done' as const, question, intent: action.result.intent, result: action.result } }
      const pendingTasks = action.result.kind === 'task' && (action.result.status === 'queued' || action.result.status === 'running') ? { ...state.pendingTasks, [action.result.taskId]: action.utteranceId } : state.pendingTasks
      return { ...state, results, pendingTasks, thinking: Math.max(0, state.thinking - 1) }
    }
    case 'failed': {
      const entry = state.results[action.utteranceId]
      return {
        ...state,
        results: { ...state.results, [action.utteranceId]: { status: 'error', question: entry?.question ?? '', intent: entry?.intent, error: action.error } },
        thinking: Math.max(0, state.thinking - 1),
      }
    }
    case 'task': {
      const utteranceId = state.pendingTasks[action.task.taskId]
      if (!utteranceId) return state
      const entry = state.results[utteranceId]
      const results = { ...state.results, [utteranceId]: { status: 'done' as const, question: entry?.question ?? action.task.question, intent: action.task.intent, result: action.task } }
      const finished = action.task.status === 'done' || action.task.status === 'failed'
      if (!finished) return { ...state, results }
      const { [action.task.taskId]: _, ...pendingTasks } = state.pendingTasks
      const onScreen = state.current?.kind === 'result' && state.current.id === utteranceId
      if (!state.current) {
        // Nothing else on screen: show the finished document right away.
        return { ...state, results, pendingTasks, current: { kind: 'result', id: utteranceId, facet: 'general', utteranceId, seq: state.seq } }
      }
      // Otherwise it waits in the tray, highlighted until someone opens it.
      return { ...state, results, pendingTasks, fresh: onScreen ? state.fresh : [...state.fresh.filter((id) => id !== utteranceId), utteranceId] }
    }
    case 'judged': {
      const utterances = state.utterances.map((u) => (u.id === action.utteranceId ? { ...u, pending: false, result: action.result } : u))
      const r = action.result
      let { current, history } = state
      const id = shownId(r)
      if (r.action === 'show' && id && r.target === 'person' && action.seq >= (current?.seq ?? -1)) {
        // A person beats the open answer: the profile card is the better screen for "who is X".
        current = { kind: 'person', id, facet: 'general', utteranceId: action.utteranceId, seq: action.seq }
        history = pushHistory(history.filter((h) => !(h.kind === 'result' && h.id === action.utteranceId)), current)
      } else if (r.mode === 'ambient' && r.action === 'show' && id && r.target && action.seq > (current?.seq ?? -1)) {
        // Ambient mode only: topic cards surface on their own.
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
    case 'show': {
      const seq = state.seq + 1
      const current: Shown = { kind: 'result', id: action.utteranceId, facet: 'general', utteranceId: action.utteranceId, seq }
      return { ...state, seq, current, history: pushHistory(state.history, current), fresh: state.fresh.filter((id) => id !== action.utteranceId) }
    }
    case 'arm':
      return { ...state, armed: action.armed }
    case 'dismiss':
      return { ...state, current: null, armed: false }
    case 'restore':
      return { ...EMPTY, ...action.state }
    case 'reset':
      return EMPTY
  }
}

const STORAGE_KEY = 'bolek-meeting-v1'

interface Persisted extends Pick<MeetingState, 'utterances' | 'results' | 'history' | 'seq' | 'pendingTasks'> {
  scenarioId: string
  cursor: number
  mode: ListeningMode
}

function loadPersisted(): Persisted | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Persisted>
    if (!Array.isArray(parsed.utterances)) return null
    // Anything still loading when the page went away is gone for good; running background tasks are polled again.
    const results: MeetingState['results'] = {}
    for (const [k, v] of Object.entries(parsed.results ?? {})) if (v.status === 'done') results[k] = v
    return {
      utterances: parsed.utterances.map((u) => ({ ...u, pending: false })),
      results,
      history: parsed.history ?? [],
      seq: parsed.seq ?? 0,
      pendingTasks: parsed.pendingTasks ?? {},
      scenarioId: parsed.scenarioId ?? SCENARIOS[0]!.id,
      cursor: parsed.cursor ?? 0,
      mode: parsed.mode ?? 'wake',
    }
  } catch {
    return null
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
  intent: { id: 'general', confidence: 0 },
  action: 'none',
  target: null,
  error,
})

const toTranscript = (utterances: Utterance[]): TranscriptLine[] => utterances.map((u) => ({ id: u.id, speaker: u.speaker, text: u.text, at: u.at, addressed: u.addressed }))

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

  // Restore the meeting after a reload, then keep saving it.
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const saved = loadPersisted()
    if (saved) {
      const { scenarioId: sid, cursor: c, mode: m, ...rest } = saved
      dispatch({ type: 'restore', state: rest })
      seq.current = rest.seq + rest.utterances.length
      if (SCENARIOS.some((s) => s.id === sid)) setScenarioId(sid)
      setCursor(c)
      setMode(m)
    }
  }, [])
  useEffect(() => {
    if (!restored.current) return
    try {
      const { utterances, results, history, seq: s, pendingTasks } = state
      const blob: Persisted = { utterances, results, history, seq: s, pendingTasks, scenarioId, cursor, mode }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))
    } catch {
      /* storage full or blocked: the meeting simply is not persisted */
    }
  }, [state, scenarioId, cursor, mode])

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
      const before = stateRef.current.utterances
      const recent = [...before.slice(-5).map((u) => ({ speaker: u.speaker, text: u.text })), { speaker, text: command }]
      const transcript = [...toTranscript(before), { id, speaker, text: command, at: base.at, addressed }]

      if (addressed) dispatch({ type: 'ask', utteranceId: id, question: command, seq: mySeq })

      // Jev first: is this about a person, and what kind of request is it?
      judgeUtterance({ data: { meeting: meetingInfo, recent, mode: judgeMode } })
        .catch((err: unknown) => EMPTY_RESULT(judgeMode, err instanceof Error ? err.message : String(err)))
        .then((result) => {
          dispatch({ type: 'judged', utteranceId: id, seq: mySeq, result })
          if (!addressed) return
          if (result.action === 'show' && result.target === 'person') {
            // The person card is the answer; no further action needed.
            dispatch({ type: 'failed', utteranceId: id, error: 'person' })
            return
          }
          const intent: Intent = result.intent.id === 'person' ? 'data' : result.intent.id
          dispatch({ type: 'intent', utteranceId: id, intent })
          return runAction({ data: { intent, request: command, transcript } })
            .then((action) => dispatch({ type: 'resolved', utteranceId: id, result: action }))
            .catch((err: unknown) => dispatch({ type: 'failed', utteranceId: id, error: err instanceof Error ? err.message : String(err) }))
        })
    },
    [meetingInfo, mode],
  )

  // Poll background tasks while any are running.
  const pendingKey = Object.keys(state.pendingTasks).join(',')
  useEffect(() => {
    if (!pendingKey) return
    const ids = pendingKey.split(',')
    const tick = () => {
      for (const taskId of ids) {
        getTask({ data: { taskId } })
          .then((task) => {
            if (task) dispatch({ type: 'task', task })
          })
          .catch(() => {})
      }
    }
    const id = window.setInterval(tick, 2000)
    return () => window.clearInterval(id)
  }, [pendingKey])

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
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
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
      // A focused button already acts on Space; do not also advance the script.
      if (target && (target.tagName === 'BUTTON' || target.closest('button'))) return
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
  const currentEntry = state.current?.kind === 'result' ? state.results[state.current.id] : undefined
  const showing = Boolean(state.current && (currentCard || currentPerson || currentEntry))
  const trigger = state.current ? state.utterances.find((u) => u.id === state.current!.utteranceId) : undefined
  const triggeredBy = trigger ? { speaker: trigger.speaker, text: trigger.text } : undefined
  const checks = state.utterances.filter((u) => u.expect !== undefined && (u.result || u.skipped))
  const passed = checks.filter((u) => expectedId(u) === shownId(u.result)).length
  const live = listening || playing
  const transcript = useMemo(() => toTranscript(state.utterances), [state.utterances])
  const runningTasks = pendingKey ? pendingKey.split(',').length : 0

  const orbState: OrbState = state.thinking > 0 ? 'thinking' : state.armed ? 'speaking' : live ? 'listening' : 'idle'
  const status = state.thinking > 0 ? 'Sprawdzam' : state.armed ? `${ASSISTANT_NAME} słucha` : live ? (mode === 'wake' ? `Czekam na „${ASSISTANT_NAME}”` : 'Słucham') : 'Gotowy'

  const trayItems: TrayItem[] = state.history
    .filter((h) => !(state.current && sameTarget(state.current, h)))
    .slice(0, 6)
    .flatMap((h): TrayItem[] => {
      const key = `${h.kind}-${h.id}-${h.facet}`
      if (h.kind === 'person') {
        const p = personCardById(h.id)
        return p ? [{ key, kind: 'person', title: p.name, subtitle: p.role, status: 'done' }] : []
      }
      if (h.kind === 'card') {
        const c = cardById(h.id)
        return c ? [{ key, kind: 'card', title: c.title, subtitle: FACET_LABEL[h.facet], status: 'done' }] : []
      }
      const e = state.results[h.id]
      if (!e) return []
      const fresh = state.fresh.includes(h.id)
      if (e.status === 'loading') return [{ key, kind: (e.intent ?? 'data') as TrayItem['kind'], title: e.question, status: 'running' }]
      if (e.status === 'error') return e.error === 'person' ? [] : [{ key, kind: (e.intent ?? 'general') as TrayItem['kind'], title: e.question, subtitle: 'nie udało się', status: 'done' }]
      const r = e.result
      if (r.kind === 'task') {
        const running = r.status === 'queued' || r.status === 'running'
        return [{ key, kind: 'report', title: r.title ?? r.question, subtitle: running ? undefined : r.question, status: running ? 'running' : fresh ? 'fresh' : 'done', seconds: running ? Math.round((Date.now() - r.startedAt) / 1000) : undefined }]
      }
      if (r.kind === 'note') return [{ key, kind: 'meeting', title: r.title, subtitle: r.question, status: fresh ? 'fresh' : 'done' }]
      return [{ key, kind: r.intent as TrayItem['kind'], title: r.headline || r.question, subtitle: r.headline ? r.question : undefined, status: fresh ? 'fresh' : 'done' }]
    })
  const openTrayItem = (item: TrayItem) => {
    const h = state.history.find((x) => `${x.kind}-${x.id}-${x.facet}` === item.key)
    if (!h) return
    if (h.kind === 'result') dispatch({ type: 'show', utteranceId: h.id })
    else dispatch({ type: 'pin', kind: h.kind, id: h.id, facet: h.facet })
  }

  const historyLabel = (h: Shown): string | null => {
    if (h.kind === 'person') return personCardById(h.id)?.name ?? null
    if (h.kind === 'card') return cardById(h.id) ? `${cardById(h.id)!.title} · ${FACET_LABEL[h.facet]}` : null
    const e = state.results[h.id]
    if (!e) return null
    let q = e.question
    if (e.status === 'done') {
      if (e.result.kind === 'note') q = e.result.title
      else if (e.result.kind === 'task') q = e.result.title ?? e.question
      else if (e.result.headline) q = e.result.headline
    }
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
        <Button size="icon-sm" variant="ghost" onClick={reset} title="Od nowa (czyści transkrypcję)">
          <RotateCcwIcon />
        </Button>
        <span className="min-w-0 flex-1 truncate pl-2 text-xs text-muted-foreground">
          {!scriptDone && `Linia ${cursor} z ${scenario.lines.length} · `}
          <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
          {state.utterances.length > 0 && ` · ${state.utterances.length} wypowiedzi`}
          {speech.engine && listening && ` · ${speech.engine === 'grok' ? 'Grok Voice Transcribe' : 'mikrofon przeglądarki'}`}
          {runningTasks > 0 && ` · ${runningTasks} zadanie w tle`}
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
        {/* Left: what moved to the background. */}
        <Tray items={trayItems} onOpen={openTrayItem} className="absolute top-1/2 left-4 z-20 w-56 -translate-y-1/2 md:left-6" />

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
                ? 'Pytaj o ludzi, dane firmy, to spotkanie, internet albo poproś o raport.'
                : mode === 'wake'
                  ? `„${ASSISTANT_NAME}, ile zapłaciliśmy za Pipedrive w sierpniu?” · „${ASSISTANT_NAME}, zrób punkty z ostatniego tematu” · „${ASSISTANT_NAME}, dzięki”.`
                  : scenario.goal}
            </p>
          </div>
        </div>

        {showing && state.current && (
          <div key={`${state.current.kind}-${state.current.id}-${state.current.facet}-${state.current.seq}`} className={cn('absolute inset-0 overflow-y-auto px-6 pt-16 pb-8 md:px-10', trayItems.length > 0 && 'md:pl-[16.5rem]')}>
            <div className="mx-auto max-w-6xl animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 fill-mode-both">
              <div className="mb-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'dismiss' })} title={`Albo powiedz „${ASSISTANT_NAME}, dzięki”`}>
                  <XIcon /> Schowaj
                </Button>
              </div>
              {currentCard && <KnowledgeCardView card={currentCard} facet={state.current.facet} triggeredBy={triggeredBy} />}
              {currentPerson && <PersonCardView person={currentPerson} triggeredBy={triggeredBy} onOpenCard={(id) => dispatch({ type: 'pin', kind: 'card', id })} />}
              {currentEntry?.status === 'loading' && <AnswerLoadingView question={currentEntry.question} intent={currentEntry.intent} triggeredBy={triggeredBy} />}
              {currentEntry?.status === 'error' && currentEntry.error !== 'person' && <AnswerErrorView question={currentEntry.question} error={currentEntry.error} />}
              {currentEntry?.status === 'done' && currentEntry.result.kind === 'answer' && <AnswerCardView result={currentEntry.result} triggeredBy={triggeredBy} debug={debug} />}
              {currentEntry?.status === 'done' && currentEntry.result.kind === 'note' && <NoteCardView note={currentEntry.result} transcript={transcript} triggeredBy={triggeredBy} debug={debug} />}
              {currentEntry?.status === 'done' && currentEntry.result.kind === 'task' && <ReportCardView task={currentEntry.result} triggeredBy={triggeredBy} debug={debug} />}
            </div>
          </div>
        )}

        {debug && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-[22rem] flex-col border-l border-border bg-background/95 backdrop-blur">
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
                      onClick={() => (h.kind === 'result' ? dispatch({ type: 'show', utteranceId: h.id }) : dispatch({ type: 'pin', kind: h.kind, id: h.id, facet: h.facet }))}
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

      {/* One caption line: what was said last, what is being heard now, and a finished task waiting to be seen. */}
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
            placeholder={`${ASSISTANT_NAME}, …`}
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
  const spec = result.mode === 'command' ? intentById(result.intent.id) : undefined
  return (
    <span
      className={cn('hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium lg:inline-flex', jev ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}
      title={result.error ?? (jev ? `TypeSafe ${result.model ?? 'jev'} przez ${result.via}` : 'Brak klucza — dopasowanie słów kluczowych')}
    >
      <span className={cn('size-1.5 rounded-full', jev ? 'bg-primary' : 'bg-muted-foreground')} aria-hidden />
      {jev ? `Jev · ${result.latencyMs} ms` : 'Tryb offline'}
      {spec && <span className="text-muted-foreground">· {spec.id}</span>}
    </span>
  )
}
