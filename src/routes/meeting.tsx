import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, RotateCcwIcon, SendIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'

import { AgentCardView, AgentErrorView, AgentLoadingView } from '@/components/meeting/agent-card'
import { EmailSentView } from '@/components/meeting/email-sent-card'
import { FitToScreen } from '@/components/meeting/fit-to-screen'
import { CardLoadingView, GraphPersonView, TopicCardView } from '@/components/meeting/graph-card'
import { PresentationView } from '@/components/meeting/presentation-view'
import { ReportCardView } from '@/components/meeting/report-card'
import { TranscriptRail, shownId, type Utterance } from '@/components/meeting/transcript-rail'
import { Tray, type TrayItem } from '@/components/meeting/tray'
import { Button } from '@/components/ui/button'
import { FACET_LABEL, SCENARIOS, type Facet } from '@/demo/knowledge'
import { PEOPLE } from '@/demo/seed'
import { installChimeUnlock, playChime } from '@/lib/chime'
import { matchDeck, type Deck, type DeckSummary } from '@/lib/slides'
import { useTranscription } from '@/lib/transcription'
import { cn } from '@/lib/utils'
import { ASSISTANT_NAME, isDismissal, isExit, matchWake } from '@/lib/wake-word'
import type { OrbState } from '@/registry/lib/orb-state'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'
import { ORB_COLORS } from '@/routes/app/index'
import {
  askAgent,
  getGraphCard,
  getTask,
  getPresentation,
  getSession,
  graphCatalog,
  judgeFocus,
  judgeUtterance,
  listPresentations,
  pollAgent,
  quickNotes,
  quickWeb,
  sendDraft,
  syncSession,
  type AgentResult,
  type AgentStep,
  type EmailDraft,
  type GraphCard,
  type RelevanceResult,
  type SessionLine,
  type TaskResult,
} from '@/server/meeting-assist'

/** `?new` starts a session with a clean context; `?session=<id>` opens (or keeps) that one. */
interface MeetingSearch {
  new?: boolean
  session?: string
  /** Open this presentation in focus mode right away. */
  present?: string
  /** With `new`: which scripted scenario (and company graph) the session uses. */
  scenario?: string
}

export const Route = createFileRoute('/meeting')({
  validateSearch: (search: Record<string, unknown>): MeetingSearch => {
    const out: MeetingSearch = {}
    if (search.new === true || search.new === 'true' || search.new === 1 || search.new === '1') out.new = true
    if (typeof search.session === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(search.session)) out.session = search.session
    if (typeof search.present === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(search.present)) out.present = search.present
    if (typeof search.scenario === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(search.scenario)) out.scenario = search.scenario
    return out
  },
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME} · Spotkanie na żywo` }] }),
  component: MeetingScreen,
})

/** What is on screen: a topic card, a person, or a result keyed by the utterance (or task) that produced it. */
interface Shown {
  kind: 'card' | 'person' | 'result' | 'presentation'
  id: string
  facet: Facet
  utteranceId: string
  seq: number
  /** Presentations: the slide the room was on (0-based). */
  slide?: number
}

/**
 * Focus mode: one thing owns the screen and the room steers it by voice
 * without saying the assistant's name. Presentations for now; the shape is
 * generic so other content can use it later.
 */
interface Focus {
  kind: 'presentation'
  id: string
  /** 0-based. */
  slide: number
}

/** A sent email, shown as its own confirmation card. */
interface SentResult {
  kind: 'sent'
  draft: EmailDraft
}

type ResultEntry =
  | { status: 'loading'; question: string; activity?: string; steps: AgentStep[] }
  | { status: 'done'; question: string; result: AgentResult | TaskResult | SentResult }
  | { status: 'error'; question: string; error: string }

interface MeetingState {
  utterances: Utterance[]
  current: Shown | null
  /** What was on screen, latest first, one entry per target. */
  history: Shown[]
  /** Results of addressed requests (and background tasks), keyed by utterance id or `task:<id>`. */
  results: Record<string, ResultEntry>
  /** Background report tasks still running: task id → result key. */
  pendingTasks: Record<string, string>
  /** Agent jobs in flight: job id → utterance id. */
  pendingJobs: Record<string, string>
  /** Finished background work the room has not looked at yet. */
  fresh: string[]
  /** Email drafts by id, with their send status. */
  drafts: Record<string, EmailDraft>
  /** Topic and person cards fetched from the graph, keyed by `cardKey`. */
  cards: Record<string, GraphCard>
  seq: number
  /** Someone said only the name: the next utterance is the request. */
  armed: boolean
  /** Requests in flight; the orb thinks while any are pending. */
  thinking: number
  focus: Focus | null
}

type MeetingAction =
  | { type: 'say'; utterance: Utterance }
  | { type: 'ask'; utteranceId: string; question: string; seq: number }
  | { type: 'job'; utteranceId: string; jobId: string }
  | { type: 'progress'; utteranceId: string; activity: string; steps: AgentStep[] }
  | { type: 'resolved'; utteranceId: string; result: AgentResult }
  | { type: 'failed'; utteranceId: string; error: string }
  | { type: 'task'; task: TaskResult }
  | { type: 'draft'; draft: EmailDraft }
  | { type: 'card'; key: string; card: GraphCard }
  | { type: 'judged'; utteranceId: string; seq: number; result: RelevanceResult }
  | { type: 'pin'; kind: 'card' | 'person'; id: string; facet?: Facet }
  | { type: 'show'; id: string }
  | { type: 'arm'; armed: boolean }
  | { type: 'dismiss' }
  | { type: 'restore'; state: Persisted }
  | { type: 'reset' }
  | { type: 'focus'; id: string; slide?: number; utteranceId?: string }
  | { type: 'slide'; slide: number; total: number }
  | { type: 'unfocus' }
  /** A line judged in focus mode: done thinking, nothing more to do with it. */
  | { type: 'settle'; utteranceId: string }

const EMPTY: MeetingState = { utterances: [], current: null, history: [], results: {}, pendingTasks: {}, pendingJobs: {}, fresh: [], drafts: {}, cards: {}, seq: 0, armed: false, thinking: 0, focus: null }

/** A person card is the same from every angle; a topic card depends on the facet. */
const cardKey = (kind: 'card' | 'person', id: string, facet: Facet): string => (kind === 'person' ? `person:${id}` : `card:${id}:${facet}`)

/** Errors that mean "handled elsewhere", not a failure to show. */
const SILENT_ERRORS = new Set(['person', 'card', 'ui'])

const sameTarget = (a: Shown, b: Shown) => a.kind === b.kind && a.id === b.id && (a.kind !== 'card' || a.facet === b.facet)

function pushHistory(history: Shown[], next: Shown): Shown[] {
  return [next, ...history.filter((h) => !sameTarget(h, next))].slice(0, 12)
}

/** Focus lasts only while its item is what is on screen: anything else taking the screen ends it. */
function reducer(state: MeetingState, action: MeetingAction): MeetingState {
  const next = reduce(state, action)
  if (next.focus && !(next.current?.kind === 'presentation' && next.current.id === next.focus.id)) return { ...next, focus: null }
  return next
}

function reduce(state: MeetingState, action: MeetingAction): MeetingState {
  switch (action.type) {
    case 'say': {
      const pending = !action.utterance.skipped
      return { ...state, utterances: [...state.utterances, { ...action.utterance, pending }].slice(-300), thinking: state.thinking + (pending ? 1 : 0) }
    }
    case 'ask': {
      // The result card appears at once and fills in as the agent works.
      const current: Shown = { kind: 'result', id: action.utteranceId, facet: 'general', utteranceId: action.utteranceId, seq: action.seq }
      return { ...state, current, history: pushHistory(state.history, current), results: { ...state.results, [action.utteranceId]: { status: 'loading', question: action.question, steps: [] } }, thinking: state.thinking + 1 }
    }
    case 'job':
      return { ...state, pendingJobs: { ...state.pendingJobs, [action.jobId]: action.utteranceId } }
    case 'progress': {
      const entry = state.results[action.utteranceId]
      if (!entry || entry.status !== 'loading') return state
      return { ...state, results: { ...state.results, [action.utteranceId]: { ...entry, activity: action.activity, steps: action.steps } } }
    }
    case 'resolved': {
      const entry = state.results[action.utteranceId]
      const question = entry?.question ?? action.result.question
      let { results, history, pendingTasks, drafts } = state
      results = { ...results, [action.utteranceId]: { status: 'done', question, result: action.result } }
      // Background reports become their own tray entries; email drafts get tracked for sending.
      for (const a of action.result.attachments) {
        if (a.type === 'task') {
          const key = `task:${a.task.taskId}`
          results = { ...results, [key]: { status: 'done', question: a.task.question, result: a.task } }
          pendingTasks = { ...pendingTasks, [a.task.taskId]: key }
          history = pushHistory(history, { kind: 'result', id: key, facet: 'general', utteranceId: action.utteranceId, seq: -1 })
        } else if (a.type === 'email_draft') {
          drafts = { ...drafts, [a.id]: { id: a.id, to: a.to, subject: a.subject, body: a.body, createdAt: Date.now(), status: 'draft' } }
        }
      }
      const pendingJobs = Object.fromEntries(Object.entries(state.pendingJobs).filter(([, u]) => u !== action.utteranceId))
      return { ...state, results, history, pendingTasks, pendingJobs, drafts, thinking: Math.max(0, state.thinking - 1) }
    }
    case 'failed': {
      const entry = state.results[action.utteranceId]
      const pendingJobs = Object.fromEntries(Object.entries(state.pendingJobs).filter(([, u]) => u !== action.utteranceId))
      return {
        ...state,
        results: { ...state.results, [action.utteranceId]: { status: 'error', question: entry?.question ?? '', error: action.error } },
        pendingJobs,
        thinking: Math.max(0, state.thinking - 1),
      }
    }
    case 'task': {
      const key = state.pendingTasks[action.task.taskId]
      if (!key) return state
      const entry = state.results[key]
      const results = { ...state.results, [key]: { status: 'done' as const, question: entry?.question ?? action.task.question, result: action.task } }
      const finished = action.task.status === 'done' || action.task.status === 'failed'
      if (!finished) return { ...state, results }
      const { [action.task.taskId]: _, ...pendingTasks } = state.pendingTasks
      const onScreen = state.current?.kind === 'result' && state.current.id === key
      if (!state.current) {
        return { ...state, results, pendingTasks, current: { kind: 'result', id: key, facet: 'general', utteranceId: '', seq: state.seq } }
      }
      return { ...state, results, pendingTasks, fresh: onScreen ? state.fresh : [...state.fresh.filter((id) => id !== key), key] }
    }
    case 'draft': {
      const drafts = { ...state.drafts, [action.draft.id]: action.draft }
      if (action.draft.status !== 'sent') return { ...state, drafts }
      // Sent: a confirmation card takes the screen; the draft itself stays reachable in the tray.
      const key = `sent:${action.draft.id}`
      const seq = state.seq + 1
      const current: Shown = { kind: 'result', id: key, facet: 'general', utteranceId: '', seq }
      return { ...state, drafts, seq, current, history: pushHistory(state.history, current), results: { ...state.results, [key]: { status: 'done', question: `Mail do ${action.draft.to.join(', ')}`, result: { kind: 'sent', draft: action.draft } } } }
    }
    case 'card':
      return { ...state, cards: { ...state.cards, [action.key]: action.card } }
    case 'judged': {
      const utterances = state.utterances.map((u) => (u.id === action.utteranceId ? { ...u, pending: false, result: action.result } : u))
      const r = action.result
      let { current, history } = state
      const id = shownId(r)
      // Addressed: the graph card replaces the loading card of the same seq. Ambient: cards surface on their own, never over something newer.
      const wins = r.mode === 'command' ? action.seq >= (current?.seq ?? -1) : action.seq > (current?.seq ?? -1)
      if (r.action === 'show' && id && r.target && wins) {
        current = { kind: r.target === 'person' ? 'person' : 'card', id, facet: r.target === 'person' ? 'general' : r.facet.id, utteranceId: action.utteranceId, seq: action.seq }
        history = pushHistory(history.filter((h) => !(h.kind === 'result' && h.id === action.utteranceId)), current)
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
      const previous = state.history.find((h) => h.kind === 'result' && h.id === action.id)
      const current: Shown = { kind: 'result', id: action.id, facet: 'general', utteranceId: previous?.utteranceId ?? action.id, seq }
      return { ...state, seq, current, history: pushHistory(state.history, current), fresh: state.fresh.filter((id) => id !== action.id) }
    }
    case 'arm':
      return { ...state, armed: action.armed }
    case 'dismiss':
      return { ...state, current: null, armed: false }
    case 'restore':
      return { ...EMPTY, ...action.state }
    case 'reset':
      return EMPTY
    case 'focus': {
      const seq = state.seq + 1
      const remembered = state.history.find((h) => h.kind === 'presentation' && h.id === action.id)?.slide ?? 0
      const slide = action.slide ?? remembered
      const current: Shown = { kind: 'presentation', id: action.id, facet: 'general', utteranceId: action.utteranceId ?? '', seq, slide }
      return { ...state, seq, current, history: pushHistory(state.history, current), focus: { kind: 'presentation', id: action.id, slide }, armed: false }
    }
    case 'slide': {
      if (!state.focus || !state.current || state.current.kind !== 'presentation') return state
      const slide = Math.min(Math.max(0, action.slide), Math.max(0, action.total - 1))
      const current = { ...state.current, slide }
      return { ...state, current, history: pushHistory(state.history, current), focus: { ...state.focus, slide } }
    }
    case 'unfocus':
      return { ...state, current: null, focus: null, armed: false }
    case 'settle':
      return { ...state, utterances: state.utterances.map((u) => (u.id === action.utteranceId ? { ...u, pending: false, skipped: true } : u)), thinking: Math.max(0, state.thinking - 1) }
  }
}

const STORAGE_KEY = 'bolek-meeting-v2'

interface Persisted extends Pick<MeetingState, 'utterances' | 'results' | 'history' | 'seq' | 'pendingTasks' | 'drafts' | 'focus' | 'cards'> {
  sessionId: string
  scenarioId: string
  cursor: number
}

const newSessionId = (): string => `meet-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`

function loadPersisted(): Persisted | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Persisted>
    if (!Array.isArray(parsed.utterances)) return null
    // Anything still loading when the page went away is gone for good; running report tasks are polled again.
    const results: MeetingState['results'] = {}
    for (const [k, v] of Object.entries(parsed.results ?? {})) if (v.status === 'done') results[k] = v
    return {
      utterances: parsed.utterances.map((u) => ({ ...u, pending: false })),
      results,
      history: (parsed.history ?? []).filter((h) => h.kind !== 'result' || results[h.id]),
      seq: parsed.seq ?? 0,
      pendingTasks: parsed.pendingTasks ?? {},
      drafts: parsed.drafts ?? {},
      cards: parsed.cards ?? {},
      focus: parsed.focus ?? null,
      sessionId: parsed.sessionId ?? newSessionId(),
      scenarioId: parsed.scenarioId ?? SCENARIOS[0]!.id,
      cursor: parsed.cursor ?? 0,
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
  intent: { id: 'ask', confidence: 0 },
  action: 'none',
  target: null,
  error,
})

const toLines = (utterances: Utterance[]): SessionLine[] => utterances.map((u) => ({ id: u.id, speaker: u.speaker, text: u.text, at: u.at, addressed: u.addressed }))

function MeetingScreen() {
  const [state, dispatch] = useReducer(reducer, EMPTY)
  const [sessionId, setSessionId] = useState<string>('')
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.id)
  const scenario = useMemo(() => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!, [scenarioId])
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [debug, setDebug] = useState(false)
  const [typed, setTyped] = useState('')
  const [sendingDraft, setSendingDraft] = useState<string | null>(null)
  const seq = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state
  const synced = useRef(0)
  const stackRef = useRef<HTMLDivElement>(null)

  // Company presentations: the list for Jev to pick from, full decks once opened.
  const [deckList, setDeckList] = useState<DeckSummary[]>([])
  const [decks, setDecks] = useState<Record<string, Deck>>({})
  const decksRef = useRef(decks)
  decksRef.current = decks
  const refreshDecks = useCallback(
    () =>
      listPresentations()
        .then((list) => {
          setDeckList(list)
          return list
        })
        .catch(() => [] as DeckSummary[]),
    [],
  )
  useEffect(() => {
    void refreshDecks()
  }, [refreshDecks])

  // Who and what the graph knows, for tray titles and the debug rail. Cards themselves are fetched when shown.
  const [catalog, setCatalog] = useState<{ topics: { id: string; label: string; subtitle: string }[]; people: { id: string; label: string; role?: string }[] }>({ topics: [], people: [] })
  useEffect(() => {
    graphCatalog()
      .then((c) => setCatalog({ topics: c.topics, people: c.people }))
      .catch(() => {})
  }, [])
  const entityLabels = useMemo(() => {
    const out: Record<string, string> = {}
    for (const t of catalog.topics) out[t.id] = t.label
    for (const p of catalog.people) out[p.id] = p.label
    return out
  }, [catalog])

  // Bolek never speaks: a chime confirms each action. Audio needs a gesture first.
  useEffect(() => installChimeUnlock(), [])

  /** Puts a deck on screen in focus mode, fetching its slides if needed. */
  const openDeck = useCallback((id: string, slide?: number, utteranceId?: string) => {
    dispatch({ type: 'focus', id, slide, utteranceId })
    if (decksRef.current[id]) return
    getPresentation({ data: { id } })
      .then((deck) => {
        if (deck) setDecks((d) => ({ ...d, [deck.id]: deck }))
        else dispatch({ type: 'unfocus' })
      })
      .catch(() => dispatch({ type: 'unfocus' }))
  }, [])
  // A restored presentation needs its slides too.
  const focusId = state.focus?.id
  useEffect(() => {
    if (!focusId || decksRef.current[focusId]) return
    getPresentation({ data: { id: focusId } })
      .then((deck) => {
        if (deck) setDecks((d) => ({ ...d, [deck.id]: deck }))
      })
      .catch(() => {})
  }, [focusId])

  const search = Route.useSearch()
  const navigate = useNavigate()

  // Which session the room is in, decided once on mount:
  //  ?new            → a fresh id and an empty context (the dashboard orb, "Nowa sesja");
  //  ?session=<id>   → that session: the persisted one if it matches, otherwise its transcript from the server;
  //  nothing         → whatever was persisted (or a fresh id), and the URL is updated to name it.
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    const keepUrl = (id: string) => void navigate({ to: '/meeting', search: { session: id }, replace: true })
    // `?present=<deck>` is consumed here: the URL is rewritten to the session and the deck opens in focus.
    const present = search.present

    if (search.new) {
      const fresh = newSessionId()
      const chosen = search.scenario ? SCENARIOS.find((sc) => sc.id === search.scenario) : undefined
      if (chosen) setScenarioId(chosen.id)
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
      syncSession({ data: { sessionId: fresh, title: (chosen ?? scenario).title, company: (chosen ?? scenario).company, lines: [], reset: true } }).catch(() => {})
      setSessionId(fresh)
      keepUrl(fresh)
      if (present) openDeck(present, 0)
      return
    }

    const saved = loadPersisted()
    const wanted = search.session
    if (wanted && saved?.sessionId !== wanted) {
      // An earlier session: the transcript and drafts come back, results start empty.
      setSessionId(wanted)
      getSession({ data: { sessionId: wanted } })
        .then((session) => {
          if (!session) return
          const utterances: Utterance[] = session.lines.map((l) => ({ id: l.id, speaker: l.speaker, text: l.text, at: l.at, addressed: l.addressed, skipped: !l.addressed }))
          const drafts = Object.fromEntries(session.drafts.map((d) => [d.id, d]))
          dispatch({ type: 'restore', state: { utterances, results: {}, history: [], seq: 0, pendingTasks: {}, drafts, cards: {}, focus: null, sessionId: wanted, scenarioId, cursor: 0 } })
          seq.current = utterances.length
          synced.current = utterances.length
          if (present) openDeck(present, 0)
        })
        .catch(() => {})
      if (present) keepUrl(wanted)
      return
    }

    if (saved) {
      dispatch({ type: 'restore', state: saved })
      seq.current = saved.seq + saved.utterances.length
      if (SCENARIOS.some((s) => s.id === saved.scenarioId)) setScenarioId(saved.scenarioId)
      setCursor(saved.cursor)
      setSessionId(saved.sessionId)
      if (!wanted || present) keepUrl(saved.sessionId)
    } else {
      const fresh = newSessionId()
      setSessionId(fresh)
      keepUrl(fresh)
    }
    if (present) openDeck(present, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!restored.current || !sessionId) return
    try {
      const { utterances, results, history, seq: s, pendingTasks, drafts, cards, focus } = state
      const blob: Persisted = { utterances, results, history, seq: s, pendingTasks, drafts, cards, focus, sessionId, scenarioId, cursor }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))
    } catch {
      /* storage full or blocked: the meeting simply is not persisted */
    }
  }, [state, sessionId, scenarioId, cursor])

  const meetingInfo = useMemo(
    () => ({ title: scenario.title, goal: scenario.goal, participants: scenario.participantIds.map(speakerLabel), company: scenario.company }),
    [scenario],
  )

  // Every line the room says flows into the server-side session (the agent's context).
  const pushToSession = useCallback(
    (extra?: SessionLine[]) => {
      if (!sessionId) return
      const all = toLines(stateRef.current.utterances)
      const batch = [...all.slice(synced.current), ...(extra ?? [])]
      if (batch.length === 0) return
      const upTo = all.length
      syncSession({ data: { sessionId, title: meetingInfo.title, company: meetingInfo.company, lines: batch } })
        .then(() => {
          synced.current = Math.max(synced.current, upTo)
        })
        .catch(() => {})
    },
    [sessionId, meetingInfo.title, meetingInfo.company],
  )

  const trayItems = useMemo((): TrayItem[] => {
    return state.history
      .filter((h) => !(state.current && sameTarget(state.current, h)))
      .slice(0, 6)
      .flatMap((h): TrayItem[] => {
        const key = `${h.kind}-${h.id}-${h.facet}`
        if (h.kind === 'person') {
          const card = state.cards[cardKey('person', h.id, 'general')]
          const p = catalog.people.find((x) => x.id === h.id)
          const title = card?.kind === 'person' ? card.name : p?.label
          return title ? [{ key, kind: 'person', title, subtitle: card?.kind === 'person' ? card.role : p?.role, status: 'done' }] : []
        }
        if (h.kind === 'card') {
          const card = state.cards[cardKey('card', h.id, h.facet)]
          const title = card?.kind === 'topic' ? card.title : catalog.topics.find((x) => x.id === h.id)?.label
          return title ? [{ key, kind: 'card', title, subtitle: FACET_LABEL[h.facet], status: 'done' }] : []
        }
        if (h.kind === 'presentation') {
          const d = decks[h.id] ?? deckList.find((x) => x.id === h.id)
          const total = d ? (Array.isArray(d.slides) ? d.slides.length : d.slides) : 0
          return d ? [{ key, kind: 'presentation', title: d.title, subtitle: total ? `slajd ${(h.slide ?? 0) + 1} z ${total}` : undefined, status: 'done' }] : []
        }
        const e = state.results[h.id]
        if (!e) return []
        const fresh = state.fresh.includes(h.id)
        if (e.status === 'loading') return [{ key, kind: 'answer', title: e.question, subtitle: e.activity, status: 'running' }]
        if (e.status === 'error') return SILENT_ERRORS.has(e.error) ? [] : [{ key, kind: 'answer', title: e.question, subtitle: 'nie udało się', status: 'done' }]
        const r = e.result
        if (r.kind === 'sent') return [{ key, kind: 'email', title: `Wysłano: ${r.draft.subject}`, subtitle: r.draft.to.join(', '), status: 'done' }]
        if (r.kind === 'task') {
          const running = r.status === 'queued' || r.status === 'running'
          return [{ key, kind: r.category === 'website' ? 'website' : 'report', title: r.title ?? r.question, subtitle: running ? r.label : r.question, status: running ? 'running' : fresh ? 'fresh' : 'done', seconds: running ? Math.round((Date.now() - r.startedAt) / 1000) : undefined }]
        }
        const first = r.attachments.find((a) => a.type !== 'citations')
        const kind: TrayItem['kind'] =
          first?.type === 'screenshot' ? 'screenshot' : first?.type === 'chart' ? 'chart' : first?.type === 'document' ? 'document' : first?.type === 'email_draft' ? 'email' : first?.type === 'note' ? 'note' : r.steps.some((s) => s.tool === 'search_web') ? 'web' : r.steps.some((s) => s.tool === 'company_knowledge' || s.tool === 'get_entity' || s.tool === 'list_entities') ? 'data' : 'answer'
        const title = first?.type === 'document' ? first.title : first?.type === 'note' ? first.note.title : first?.type === 'email_draft' ? first.subject : r.headline || r.question
        return [{ key, kind, title, subtitle: title === r.question ? undefined : r.question, status: fresh ? 'fresh' : 'done' }]
      })
  }, [state.history, state.current, state.results, state.fresh, state.cards, catalog, decks, deckList])

  /** Background work only: running, or finished and not yet looked at. History itself is the page stack. */
  const activeItems = useMemo(() => trayItems.filter((t) => t.status !== 'done'), [trayItems])

  /** Moves the page stack by whole screens; the room says "przesuń w górę" instead of touching anything. */
  const scrollPages = useCallback((direction: -1 | 1) => {
    const el = stackRef.current
    if (!el) return
    el.scrollBy({ top: direction * el.clientHeight, behavior: 'smooth' })
  }, [])

  // Whatever topic or person is on screen gets its card from the graph (deterministic, tens of milliseconds).
  const currentKind = state.current?.kind
  const currentId = state.current?.id
  const currentFacet = state.current?.facet
  useEffect(() => {
    if (!currentId || !currentFacet || (currentKind !== 'card' && currentKind !== 'person')) return
    const key = cardKey(currentKind, currentId, currentFacet)
    if (stateRef.current.cards[key]) return
    let cancelled = false
    getGraphCard({ data: { kind: currentKind === 'person' ? 'person' : 'topic', id: currentId, facet: currentFacet } })
      .then((card) => {
        if (cancelled) return
        if (card) dispatch({ type: 'card', key, card })
        else dispatch({ type: 'dismiss' })
      })
      .catch(() => {
        if (!cancelled) playChime('error')
      })
    return () => {
      cancelled = true
    }
  }, [currentKind, currentId, currentFacet])

  // Chimes: a card landed, a result finished, a task came back. Nothing during the first moment, when a saved meeting is restored.
  const mountedAt = useRef(Date.now())
  const chimedFor = useRef('')
  useEffect(() => {
    const c = state.current
    if (!c || Date.now() - mountedAt.current < 1500) return
    let key: string | null = null
    if (c.kind === 'card' || c.kind === 'person') {
      if (!state.cards[cardKey(c.kind, c.id, c.facet)]) return
      key = `${cardKey(c.kind, c.id, c.facet)}#${c.seq}`
    } else if (c.kind === 'presentation') key = `presentation:${c.id}#${c.seq}`
    if (key && chimedFor.current !== key) {
      chimedFor.current = key
      playChime('done')
    }
  }, [state.current, state.cards])
  const previousResults = useRef(state.results)
  useEffect(() => {
    const prev = previousResults.current
    previousResults.current = state.results
    if (Date.now() - mountedAt.current < 1500) return
    for (const [k, e] of Object.entries(state.results)) {
      const p = prev[k]
      if (e.status === 'done') {
        const running = e.result.kind === 'task' && (e.result.status === 'queued' || e.result.status === 'running')
        const wasRunning = p?.status === 'done' && p.result.kind === 'task' && (p.result.status === 'queued' || p.result.status === 'running')
        if (running) continue
        if (!p || p.status !== 'done' || wasRunning) playChime(e.result.kind === 'task' && e.result.status === 'failed' ? 'error' : 'done')
      } else if (e.status === 'error' && p?.status !== 'error' && !SILENT_ERRORS.has(e.error)) playChime('error')
    }
  }, [state.results])

  const openTrayItem = useCallback((item: TrayItem) => {
    const h = stateRef.current.history.find((x) => `${x.kind}-${x.id}-${x.facet}` === item.key)
    if (!h) return
    if (h.kind === 'result') dispatch({ type: 'show', id: h.id })
    else if (h.kind === 'presentation') openDeck(h.id, h.slide)
    else dispatch({ type: 'pin', kind: h.kind, id: h.id, facet: h.facet })
  }, [openDeck])

  const send = useCallback(
    (draftId?: string) => {
      if (!sessionId) return
      setSendingDraft(draftId ?? 'latest')
      sendDraft({ data: { sessionId, draftId } })
        .then((draft) => {
          if (draft) dispatch({ type: 'draft', draft })
        })
        .catch(() => {})
        .finally(() => setSendingDraft(null))
    },
    [sessionId],
  )

  const say = useCallback(
    (speaker: string, text: string, expect?: Utterance['expect']) => {
      const id = `u-${Date.now().toString(36)}-${seq.current}`
      const mySeq = ++seq.current
      const base: Utterance = { id, speaker, text, at: Date.now(), expect }

      const wake = matchWake(text)
      const armed = stateRef.current.armed
      const addressed = wake.addressed || armed
      if (wake.addressed && wake.bare) {
        dispatch({ type: 'say', utterance: { ...base, addressed: true, skipped: true } })
        dispatch({ type: 'arm', armed: true })
        return
      }
      if (armed) dispatch({ type: 'arm', armed: false })

      const command = wake.addressed ? wake.command || text : text
      // "Kończymy spotkanie" / "wyjdź do menu", with or without the name: back to the dashboard.
      // Unmounting stops the microphone; the session stays on the server.
      if (isExit(command)) {
        dispatch({ type: 'say', utterance: { ...base, addressed: true, skipped: true } })
        playChime('soft')
        void navigate({ to: '/' })
        return
      }
      if (addressed && isDismissal(command)) {
        dispatch({ type: 'say', utterance: { ...base, addressed: true, skipped: true, dismissed: true } })
        dispatch({ type: 'dismiss' })
        playChime('soft')
        return
      }

      const runNormal = (alreadySaid = false) => {
        // The agent only acts when addressed by name; everything else is context.
        if (!addressed) {
          if (!alreadySaid) dispatch({ type: 'say', utterance: { ...base, skipped: true } })
          // Not judged, but it is context: send it to the session.
          setTimeout(() => pushToSession(), 0)
          return
        }

        if (!alreadySaid) dispatch({ type: 'say', utterance: { ...base, addressed } })
        const judgeMode = addressed ? 'command' : 'ambient'
        const before = stateRef.current.utterances
        const recent = [...before.slice(-5).map((u) => ({ speaker: u.speaker, text: u.text })), { speaker, text: command }]
        const thisLine: SessionLine = { id, speaker, text: command, at: base.at, addressed }
        const tray = trayItems.map((t) => ({ id: t.key, title: t.title }))
        setTimeout(() => pushToSession([thisLine]), 0)

        judgeUtterance({ data: { meeting: meetingInfo, recent, mode: judgeMode, trayItems: tray, presentations: deckList.map((d) => ({ id: d.id, title: d.title })) } })
          .catch((err: unknown) => EMPTY_RESULT(judgeMode, err instanceof Error ? err.message : String(err)))
          .then((result) => {
            dispatch({ type: 'judged', utteranceId: id, seq: mySeq, result })
            if (!addressed) return
            // A card from the graph beats everything: the reducer already put it on screen. A person Jev could not
            // name goes to the agent, which can search. Screen commands and cards need no result page; only the agent gets one.
            const intent = result.action === 'show' && result.target ? (result.target === 'person' ? 'person' : 'card') : result.intent.id === 'person' ? 'ask' : result.intent.id
            switch (intent) {
              case 'person':
              case 'card':
                return
              case 'ui_close':
              case 'ui_background':
                dispatch({ type: 'dismiss' })
                playChime('soft')
                return
              case 'ui_open': {
                const target = result.openTarget?.id ? trayItems.find((t) => t.key === result.openTarget!.id) : trayItems[0]
                if (target) openTrayItem(target)
                else dispatch({ type: 'dismiss' })
                playChime(target ? 'done' : 'soft')
                return
              }
              case 'ui_scroll_up':
              case 'ui_scroll_down':
                scrollPages(intent === 'ui_scroll_up' ? -1 : 1)
                playChime('soft')
                return
              case 'ui_present': {
                void refreshDecks().then((fresh) => {
                  const list = fresh.length ? fresh : deckList
                  const remembered = stateRef.current.history.find((h) => h.kind === 'presentation')
                  const pick =
                    (result.presentation?.id ? list.find((d) => d.id === result.presentation!.id) : undefined) ??
                    matchDeck(command, list) ??
                    (list.length === 1 ? list[0] : undefined) ??
                    (remembered ? list.find((d) => d.id === remembered.id) : undefined)
                  if (pick) openDeck(pick.id, undefined, id)
                  else {
                    dispatch({ type: 'ask', utteranceId: id, question: command, seq: mySeq })
                    dispatch({ type: 'failed', utteranceId: id, error: list.length ? `Nie wiem, którą prezentację otworzyć. Mam: ${list.map((d) => d.title).join(' · ')}.` : 'Nie ma jeszcze żadnej prezentacji. Dodaj ją w zakładce Presentations.' })
                  }
                })
                return
              }
              case 'ui_send': {
                const latest = Object.values(stateRef.current.drafts)
                  .filter((d) => d.status !== 'sent')
                  .sort((a, b) => b.createdAt - a.createdAt)[0]
                if (latest) {
                  send(latest.id)
                  playChime('soft')
                  return
                }
                // Nothing to send yet: "wyślij maila do Tomka…" is a request for a draft, so the agent writes one.
                break
              }
              case 'ask_meeting':
                // Notes from the transcript: one call, no agent loop. The result page appears now and fills in.
                dispatch({ type: 'ask', utteranceId: id, question: command, seq: mySeq })
                return quickNotes({ data: { sessionId, request: command, lines: [thisLine] } })
                  .then((res) => dispatch({ type: 'resolved', utteranceId: id, result: res }))
                  .catch((err: unknown) => dispatch({ type: 'failed', utteranceId: id, error: err instanceof Error ? err.message : String(err) }))
              case 'ask_web':
                dispatch({ type: 'ask', utteranceId: id, question: command, seq: mySeq })
                return quickWeb({ data: { sessionId, request: command, lines: [thisLine] } })
                  .then((res) => dispatch({ type: 'resolved', utteranceId: id, result: res }))
                  .catch((err: unknown) => dispatch({ type: 'failed', utteranceId: id, error: err instanceof Error ? err.message : String(err) }))
              default:
                break
            }
            // Company questions without a resolved entity, things to produce, and the rest: the agent decides which tools to use.
            // The result page appears now and fills in as it works.
            dispatch({ type: 'ask', utteranceId: id, question: command, seq: mySeq })
            return askAgent({ data: { sessionId, request: command, lines: [thisLine] } })
              .then(({ jobId }) => dispatch({ type: 'job', utteranceId: id, jobId }))
              .catch((err: unknown) => dispatch({ type: 'failed', utteranceId: id, error: err instanceof Error ? err.message : String(err) }))
          })
      }

      // Focus mode: every line is first read as a steering command, name or no name.
      const focus = stateRef.current.focus
      if (focus) {
        const deck = decksRef.current[focus.id]
        const total = deck?.slides.length ?? 0
        dispatch({ type: 'say', utterance: { ...base, addressed } })
        setTimeout(() => pushToSession(), 0)
        judgeFocus({ data: { text: command, focus: { kind: 'presentation', title: deck?.title ?? '', position: focus.slide + 1, total, itemTitles: deck?.slides.map((sl) => sl.title) ?? [] } } })
          .catch(() => ({ command: 'none' as const, target: null }))
          .then((r) => {
            const stillFocused = stateRef.current.focus?.id === focus.id
            if (!stillFocused || r.command === 'none') {
              // Not a command: addressed lines go the usual way, the rest is context.
              if (addressed) runNormal(true)
              else dispatch({ type: 'settle', utteranceId: id })
              return
            }
            dispatch({ type: 'settle', utteranceId: id })
            const at = stateRef.current.focus?.slide ?? focus.slide
            switch (r.command) {
              case 'next':
                dispatch({ type: 'slide', slide: at + 1, total })
                break
              case 'prev':
                dispatch({ type: 'slide', slide: at - 1, total })
                break
              case 'first':
                dispatch({ type: 'slide', slide: 0, total })
                break
              case 'last':
                dispatch({ type: 'slide', slide: total - 1, total })
                break
              case 'goto':
                if (r.target) dispatch({ type: 'slide', slide: r.target - 1, total })
                break
              case 'close':
                dispatch({ type: 'unfocus' })
                break
            }
          })
        return
      }

      runNormal()
    },
    [meetingInfo, sessionId, trayItems, openTrayItem, pushToSession, send, openDeck, refreshDecks, deckList, navigate, scrollPages],
  )

  // Poll agent jobs and background report tasks while any are running.
  const pendingJobKey = Object.entries(state.pendingJobs)
    .map(([j, u]) => `${j}:${u}`)
    .join(',')
  useEffect(() => {
    if (!pendingJobKey) return
    const pairs = pendingJobKey.split(',').map((p) => p.split(':') as [string, string])
    const tick = () => {
      for (const [jobId, utteranceId] of pairs) {
        pollAgent({ data: { jobId } })
          .then((job) => {
            if (!job) return dispatch({ type: 'failed', utteranceId, error: 'Zadanie zniknęło (restart serwera?).' })
            if (job.status === 'done' && job.result) dispatch({ type: 'resolved', utteranceId, result: job.result })
            else if (job.status === 'failed') dispatch({ type: 'failed', utteranceId, error: job.error ?? 'błąd' })
            else dispatch({ type: 'progress', utteranceId, activity: job.activity, steps: job.steps })
          })
          .catch(() => {})
      }
    }
    tick()
    const id = window.setInterval(tick, 700)
    return () => window.clearInterval(id)
  }, [pendingJobKey])

  const pendingTaskKey = Object.keys(state.pendingTasks).join(',')
  useEffect(() => {
    if (!pendingTaskKey) return
    const ids = pendingTaskKey.split(',')
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
  }, [pendingTaskKey])

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

  const reset = useCallback(() => {
    speech.stop()
    setPlaying(false)
    setCursor(0)
    dispatch({ type: 'reset' })
    synced.current = 0
    const fresh = newSessionId()
    setSessionId(fresh)
    syncSession({ data: { sessionId: fresh, title: meetingInfo.title, company: meetingInfo.company, lines: [], reset: true } }).catch(() => {})
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    void navigate({ to: '/meeting', search: { session: fresh }, replace: true })
  }, [speech, meetingInfo.title, navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      // A focused button already acts on Space; do not also advance the script.
      if (target && (target.tagName === 'BUTTON' || target.closest('button'))) return
      const focus = stateRef.current.focus
      const total = focus ? (decksRef.current[focus.id]?.slides.length ?? 0) : 0
      if (focus && (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown')) {
        e.preventDefault()
        dispatch({ type: 'slide', slide: focus.slide + 1, total })
      } else if (focus && (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp')) {
        e.preventDefault()
        dispatch({ type: 'slide', slide: focus.slide - 1, total })
      } else if (focus && e.key === 'Home') {
        dispatch({ type: 'slide', slide: 0, total })
      } else if (focus && e.key === 'End') {
        dispatch({ type: 'slide', slide: total - 1, total })
      } else if (!focus && stackRef.current && (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowDown' || e.key === 'PageDown')) {
        e.preventDefault()
        scrollPages(e.key === 'ArrowUp' || e.key === 'PageUp' ? -1 : 1)
      } else if (e.code === 'Space') {
        e.preventDefault()
        stepScenario()
      } else if (e.key === 'Escape') {
        dispatch({ type: focus ? 'unfocus' : 'dismiss' })
      } else if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
        setDebug((d) => !d)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepScenario, scrollPages])

  const submitTyped = (e: FormEvent) => {
    e.preventDefault()
    const text = typed.trim()
    if (!text) return
    say('Sala', text)
    setTyped('')
  }

  const last = state.utterances.at(-1)
  /** Whether a history entry has something to put on a page. Graph cards render at once (a skeleton until the card arrives). */
  const renderable = useCallback(
    (h: Shown): boolean => {
      if (h.kind === 'card' || h.kind === 'person') return Boolean(state.cards[cardKey(h.kind, h.id, h.facet)]) || Boolean(state.current && sameTarget(state.current, h))
      if (h.kind === 'presentation') return false
      const e = state.results[h.id]
      if (!e) return false
      // Background work still running lives on the card to the left, not as a page.
      if (e.status === 'done' && e.result.kind === 'task' && (e.result.status === 'running' || e.result.status === 'queued')) return false
      return !(e.status === 'error' && SILENT_ERRORS.has(e.error))
    },
    [state.results, state.cards, state.current],
  )
  // The screen is a stack of pages, oldest at the top, the current one at the bottom filling the viewport.
  const pages = useMemo(() => [...state.history].reverse().filter(renderable), [state.history, renderable])
  const pageKey = (h: Shown) => `${h.kind}-${h.id}-${h.facet}`
  const focusDeck = state.focus ? decks[state.focus.id] : undefined
  const showing = Boolean(state.focus) || Boolean(state.current && renderable(state.current))
  const currentKey = state.current ? `${pageKey(state.current)}-${state.current.seq}` : ''
  // A new page always lands at the bottom: bring it into view, previous pages move up off screen.
  useEffect(() => {
    if (!currentKey) return
    const el = stackRef.current
    if (!el) return
    const id = window.requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }))
    return () => window.cancelAnimationFrame(id)
  }, [currentKey, pages.length])
  const triggeredFor = (h: Shown) => {
    const u = state.utterances.find((x) => x.id === h.utteranceId)
    return u ? { speaker: u.speaker, text: u.text } : undefined
  }
  const live = listening || playing
  const transcript = useMemo(() => toLines(state.utterances), [state.utterances])

  const orbState: OrbState = state.thinking > 0 ? 'thinking' : state.armed ? 'speaking' : live ? 'listening' : 'idle'
  const status = state.focus ? 'Prezentacja' : state.thinking > 0 ? 'Sprawdzam' : state.armed ? `${ASSISTANT_NAME} słucha` : speech.status === 'connecting' ? 'Łączę' : live ? `Czekam na „${ASSISTANT_NAME}”` : 'Gotowy'
  const micUnsupported = speech.status === 'unsupported'
  const toggleMic = () => (listening ? speech.stop() : void speech.start())

  return (
    <div className="app-theme flex h-svh flex-col overflow-hidden bg-background text-foreground antialiased">

      <main className="relative min-h-0 flex-1">
        <Link
          to="/"
          className="absolute top-4 left-4 z-30 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 md:left-6"
        >
          <ArrowLeftIcon className="size-4" /> Dashboard
        </Link>

        {/* Left: background agents at work, and finished ones nobody has looked at yet. A tap or "Bolek, otwórz raport" brings one up. */}
        {!state.focus && activeItems.length > 0 && <Tray items={activeItems} onOpen={openTrayItem} className="absolute top-1/2 left-4 z-20 w-56 -translate-y-1/2 md:left-6" />}

        {/* The orb: centre stage when idle, docked at the top while something is shown. */}
        <div
          className={cn(
            'pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-6 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            showing ? 'top-3' : 'top-1/2 -translate-y-1/2',
          )}
        >
          {/* Clicking the orb starts and stops the microphone. */}
          <button
            type="button"
            onClick={toggleMic}
            disabled={micUnsupported}
            aria-pressed={listening}
            aria-label={listening ? 'Przestań słuchać' : 'Zacznij słuchać'}
            title={micUnsupported ? 'Przeglądarka nie obsługuje rozpoznawania mowy (użyj Chrome).' : listening ? 'Zatrzymaj mikrofon' : 'Włącz mikrofon'}
            className={cn(
              'pointer-events-auto rounded-full outline-none transition-[transform,filter,opacity] duration-700 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-safe:hover:scale-[1.03] motion-safe:active:scale-95 disabled:cursor-default',
              // Grey while idle, the blue palette comes back as soon as it listens.
              orbState === 'idle' && 'opacity-75 grayscale',
            )}
          >
            <NebulaOrb
              state={orbState}
              size={showing ? 44 : 220}
              colorFrom={ORB_COLORS.from}
              colorTo={ORB_COLORS.to}
              label={status}
              className="pointer-events-none transition-[width,height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            />
          </button>
          <div className={cn('flex flex-col items-center gap-2 text-center transition-opacity duration-300', showing ? 'opacity-0' : 'opacity-100 delay-200')}>
            <p className={cn('text-xs font-medium tracking-[0.18em] uppercase', state.armed ? 'text-primary' : 'text-muted-foreground')}>{status}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">{state.armed ? 'O co chodzi?' : scenario.title}</h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {state.armed
                ? 'Pytaj o ludzi, dane firmy, to spotkanie, internet; poproś o maila, dokument, wykres, raport albo zrzut strony.'
                : live
                  ? `„${ASSISTANT_NAME}, ile zapłaciliśmy za Pipedrive w sierpniu?” · „${ASSISTANT_NAME}, zrób punkty z ostatniego tematu” · „${ASSISTANT_NAME}, dzięki”.`
                  : micUnsupported
                    ? 'Przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome.'
                    : 'Kliknij, żeby zacząć słuchać.'}
            </p>
            {speech.error && <p className="text-sm text-destructive">{speech.error}</p>}
          </div>
        </div>

        {state.focus && (
          <div className="absolute inset-0 px-6 pt-14 pb-6 md:px-10">
            <PresentationView
              deck={focusDeck}
              slide={state.focus.slide}
              onMove={(index) => dispatch({ type: 'slide', slide: index, total: focusDeck?.slides.length ?? 0 })}
              onClose={() => dispatch({ type: 'unfocus' })}
              className="mx-auto h-full max-w-7xl animate-in fade-in duration-500"
            />
          </div>
        )}

        {/* Pages: one viewport each, snapping. Scroll up for earlier answers; a new one pushes the rest off the top. */}
        {showing && !state.focus && state.current && (
          <div ref={stackRef} className="absolute inset-0 snap-y snap-mandatory overflow-y-auto px-6 md:px-10">
            {pages.map((h) => {
              const graphCard = h.kind === 'card' || h.kind === 'person' ? state.cards[cardKey(h.kind, h.id, h.facet)] : undefined
              const entry = h.kind === 'result' ? state.results[h.id] : undefined
              const triggeredBy = triggeredFor(h)
              const isCurrent = state.current && sameTarget(state.current, h)
              return (
                <section key={pageKey(h)} className="h-full snap-start pt-16 pb-6" aria-current={isCurrent ? 'true' : undefined}>
                  <FitToScreen className={cn('mx-auto max-w-6xl', isCurrent && 'animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 fill-mode-both')}>
                    <div className="mb-2 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'dismiss' })} title={`Albo powiedz „${ASSISTANT_NAME}, dzięki”`}>
                        <XIcon /> Schowaj
                      </Button>
                    </div>
                    {(h.kind === 'card' || h.kind === 'person') && !graphCard && <CardLoadingView title={entityLabels[h.id] ?? ''} />}
                    {graphCard?.kind === 'topic' && <TopicCardView card={graphCard} triggeredBy={triggeredBy} onOpenPerson={(id) => dispatch({ type: 'pin', kind: 'person', id })} />}
                    {graphCard?.kind === 'person' && <GraphPersonView card={graphCard} triggeredBy={triggeredBy} onOpenTopic={(id) => dispatch({ type: 'pin', kind: 'card', id })} />}
                    {entry?.status === 'loading' && <AgentLoadingView question={entry.question} activity={entry.activity} steps={entry.steps} triggeredBy={triggeredBy} />}
                    {entry?.status === 'error' && <AgentErrorView question={entry.question} error={entry.error} />}
                    {entry?.status === 'done' && entry.result.kind === 'agent' && (
                      <AgentCardView result={entry.result} transcript={transcript} drafts={state.drafts} onSendDraft={(id) => send(id)} sendingDraft={sendingDraft} triggeredBy={triggeredBy} debug={debug} />
                    )}
                    {entry?.status === 'done' && entry.result.kind === 'task' && <ReportCardView task={entry.result} triggeredBy={triggeredBy} debug={debug} />}
                    {entry?.status === 'done' && entry.result.kind === 'sent' && <EmailSentView draft={entry.result.draft} triggeredBy={triggeredBy} />}
                  </FitToScreen>
                </section>
              )
            })}
          </div>
        )}

        {debug && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-[22rem] flex-col border-l border-border bg-background/95 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium">
              <span>Transkrypcja · diagnostyka</span>
              <span className="flex items-center gap-1">
                <Button size="icon-xs" variant="ghost" onClick={reset} title="Nowe spotkanie (czyści sesję)">
                  <RotateCcwIcon />
                </Button>
                <Button size="icon-xs" variant="ghost" onClick={() => setDebug(false)} aria-label="Zamknij">
                  <XIcon />
                </Button>
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              <TranscriptRail utterances={state.utterances} interim={speech.interim} debug labels={entityLabels} />
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
