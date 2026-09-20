import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, RotateCcwIcon, SendIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'

import { AgentCardView, AgentErrorView, AgentLoadingView } from '@/components/meeting/agent-card'
import { EmailSentView } from '@/components/meeting/email-sent-card'
import { KnowledgeCardView } from '@/components/meeting/knowledge-card'
import { PersonCardView } from '@/components/meeting/person-card'
import { ReportCardView } from '@/components/meeting/report-card'
import { TranscriptRail, shownId, type Utterance } from '@/components/meeting/transcript-rail'
import { Tray, type TrayItem } from '@/components/meeting/tray'
import { Button } from '@/components/ui/button'
import { FACET_LABEL, SCENARIOS, cardById, type Facet } from '@/demo/knowledge'
import { personCardById } from '@/demo/people'
import { PEOPLE } from '@/demo/seed'
import { useTranscription } from '@/lib/transcription'
import { cn } from '@/lib/utils'
import { ASSISTANT_NAME, isDismissal, matchWake } from '@/lib/wake-word'
import type { OrbState } from '@/registry/lib/orb-state'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'
import { ORB_COLORS } from '@/routes/app/index'
import {
  askAgent,
  getTask,
  getSession,
  judgeUtterance,
  pollAgent,
  sendDraft,
  syncSession,
  type AgentResult,
  type AgentStep,
  type EmailDraft,
  type RelevanceResult,
  type SessionLine,
  type TaskResult,
} from '@/server/meeting-assist'

/** `?new` starts a session with a clean context; `?session=<id>` opens (or keeps) that one. */
interface MeetingSearch {
  new?: boolean
  session?: string
}

export const Route = createFileRoute('/meeting')({
  validateSearch: (search: Record<string, unknown>): MeetingSearch => {
    const out: MeetingSearch = {}
    if (search.new === true || search.new === 'true' || search.new === 1 || search.new === '1') out.new = true
    if (typeof search.session === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(search.session)) out.session = search.session
    return out
  },
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME} · Spotkanie na żywo` }] }),
  component: MeetingScreen,
})

/** What is on screen: a topic card, a person, or a result keyed by the utterance (or task) that produced it. */
interface Shown {
  kind: 'card' | 'person' | 'result'
  id: string
  facet: Facet
  utteranceId: string
  seq: number
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
  seq: number
  /** Someone said only the name: the next utterance is the request. */
  armed: boolean
  /** Requests in flight; the orb thinks while any are pending. */
  thinking: number
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
  | { type: 'judged'; utteranceId: string; seq: number; result: RelevanceResult }
  | { type: 'pin'; kind: 'card' | 'person'; id: string; facet?: Facet }
  | { type: 'show'; id: string }
  | { type: 'arm'; armed: boolean }
  | { type: 'dismiss' }
  | { type: 'restore'; state: Persisted }
  | { type: 'reset' }

const EMPTY: MeetingState = { utterances: [], current: null, history: [], results: {}, pendingTasks: {}, pendingJobs: {}, fresh: [], drafts: {}, seq: 0, armed: false, thinking: 0 }

const sameTarget = (a: Shown, b: Shown) => a.kind === b.kind && a.id === b.id && (a.kind !== 'card' || a.facet === b.facet)

function pushHistory(history: Shown[], next: Shown): Shown[] {
  return [next, ...history.filter((h) => !sameTarget(h, next))].slice(0, 12)
}

function reducer(state: MeetingState, action: MeetingAction): MeetingState {
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
    case 'judged': {
      const utterances = state.utterances.map((u) => (u.id === action.utteranceId ? { ...u, pending: false, result: action.result } : u))
      const r = action.result
      let { current, history } = state
      const id = shownId(r)
      if (r.action === 'show' && id && r.target === 'person' && action.seq >= (current?.seq ?? -1)) {
        // A person beats the agent: the profile card is the better screen for "who is X".
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
  }
}

const STORAGE_KEY = 'bolek-meeting-v2'

interface Persisted extends Pick<MeetingState, 'utterances' | 'results' | 'history' | 'seq' | 'pendingTasks' | 'drafts'> {
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

    if (search.new) {
      const fresh = newSessionId()
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
      syncSession({ data: { sessionId: fresh, title: scenario.title, lines: [], reset: true } }).catch(() => {})
      setSessionId(fresh)
      keepUrl(fresh)
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
          dispatch({ type: 'restore', state: { utterances, results: {}, history: [], seq: 0, pendingTasks: {}, drafts, sessionId: wanted, scenarioId, cursor: 0 } })
          seq.current = utterances.length
          synced.current = utterances.length
        })
        .catch(() => {})
      return
    }

    if (saved) {
      dispatch({ type: 'restore', state: saved })
      seq.current = saved.seq + saved.utterances.length
      if (SCENARIOS.some((s) => s.id === saved.scenarioId)) setScenarioId(saved.scenarioId)
      setCursor(saved.cursor)
      setSessionId(saved.sessionId)
      if (!wanted) keepUrl(saved.sessionId)
    } else {
      const fresh = newSessionId()
      setSessionId(fresh)
      keepUrl(fresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!restored.current || !sessionId) return
    try {
      const { utterances, results, history, seq: s, pendingTasks, drafts } = state
      const blob: Persisted = { utterances, results, history, seq: s, pendingTasks, drafts, sessionId, scenarioId, cursor }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))
    } catch {
      /* storage full or blocked: the meeting simply is not persisted */
    }
  }, [state, sessionId, scenarioId, cursor])

  const meetingInfo = useMemo(
    () => ({ title: scenario.title, goal: scenario.goal, participants: scenario.participantIds.map(speakerLabel) }),
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
      syncSession({ data: { sessionId, title: meetingInfo.title, lines: batch } })
        .then(() => {
          synced.current = Math.max(synced.current, upTo)
        })
        .catch(() => {})
    },
    [sessionId, meetingInfo.title],
  )

  const trayItems = useMemo((): TrayItem[] => {
    return state.history
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
        if (e.status === 'loading') return [{ key, kind: 'answer', title: e.question, subtitle: e.activity, status: 'running' }]
        if (e.status === 'error') return e.error === 'person' || e.error === 'ui' ? [] : [{ key, kind: 'answer', title: e.question, subtitle: 'nie udało się', status: 'done' }]
        const r = e.result
        if (r.kind === 'sent') return [{ key, kind: 'email', title: `Wysłano: ${r.draft.subject}`, subtitle: r.draft.to.join(', '), status: 'done' }]
        if (r.kind === 'task') {
          const running = r.status === 'queued' || r.status === 'running'
          return [{ key, kind: 'report', title: r.title ?? r.question, subtitle: running ? undefined : r.question, status: running ? 'running' : fresh ? 'fresh' : 'done', seconds: running ? Math.round((Date.now() - r.startedAt) / 1000) : undefined }]
        }
        const first = r.attachments.find((a) => a.type !== 'citations')
        const kind: TrayItem['kind'] =
          first?.type === 'screenshot' ? 'screenshot' : first?.type === 'chart' ? 'chart' : first?.type === 'document' ? 'document' : first?.type === 'email_draft' ? 'email' : first?.type === 'note' ? 'note' : r.steps.some((s) => s.tool === 'search_web') ? 'web' : r.steps.some((s) => s.tool === 'company_knowledge' || s.tool === 'get_entity' || s.tool === 'list_entities') ? 'data' : 'answer'
        const title = first?.type === 'document' ? first.title : first?.type === 'note' ? first.note.title : first?.type === 'email_draft' ? first.subject : r.headline || r.question
        return [{ key, kind, title, subtitle: title === r.question ? undefined : r.question, status: fresh ? 'fresh' : 'done' }]
      })
  }, [state.history, state.current, state.results, state.fresh])

  const openTrayItem = useCallback((item: TrayItem) => {
    const h = stateRef.current.history.find((x) => `${x.kind}-${x.id}-${x.facet}` === item.key)
    if (!h) return
    if (h.kind === 'result') dispatch({ type: 'show', id: h.id })
    else dispatch({ type: 'pin', kind: h.kind, id: h.id, facet: h.facet })
  }, [])

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
      if (addressed && isDismissal(command)) {
        dispatch({ type: 'say', utterance: { ...base, addressed: true, skipped: true, dismissed: true } })
        dispatch({ type: 'dismiss' })
        return
      }

      // The agent only acts when addressed by name; everything else is context.
      if (!addressed) {
        dispatch({ type: 'say', utterance: { ...base, skipped: true } })
        // Not judged, but it is context: send it to the session.
        setTimeout(() => pushToSession(), 0)
        return
      }

      dispatch({ type: 'say', utterance: { ...base, addressed } })
      const judgeMode = addressed ? 'command' : 'ambient'
      const before = stateRef.current.utterances
      const recent = [...before.slice(-5).map((u) => ({ speaker: u.speaker, text: u.text })), { speaker, text: command }]
      const thisLine: SessionLine = { id, speaker, text: command, at: base.at, addressed }
      const tray = trayItems.map((t) => ({ id: t.key, title: t.title }))
      setTimeout(() => pushToSession([thisLine]), 0)

      if (addressed) dispatch({ type: 'ask', utteranceId: id, question: command, seq: mySeq })

      judgeUtterance({ data: { meeting: meetingInfo, recent, mode: judgeMode, trayItems: tray } })
        .catch((err: unknown) => EMPTY_RESULT(judgeMode, err instanceof Error ? err.message : String(err)))
        .then((result) => {
          dispatch({ type: 'judged', utteranceId: id, seq: mySeq, result })
          if (!addressed) return
          const intent = result.action === 'show' && result.target === 'person' ? 'person' : result.intent.id
          switch (intent) {
            case 'person':
              dispatch({ type: 'failed', utteranceId: id, error: 'person' })
              return
            case 'ui_close':
            case 'ui_background':
              dispatch({ type: 'failed', utteranceId: id, error: 'ui' })
              dispatch({ type: 'dismiss' })
              return
            case 'ui_open': {
              dispatch({ type: 'failed', utteranceId: id, error: 'ui' })
              const target = result.openTarget?.id ? trayItems.find((t) => t.key === result.openTarget!.id) : trayItems[0]
              if (target) openTrayItem(target)
              else dispatch({ type: 'dismiss' })
              return
            }
            case 'ui_send': {
              dispatch({ type: 'failed', utteranceId: id, error: 'ui' })
              const latest = Object.values(stateRef.current.drafts)
                .filter((d) => d.status !== 'sent')
                .sort((a, b) => b.createdAt - a.createdAt)[0]
              send(latest?.id)
              return
            }
            default:
              break
          }
          // Everything else: the agent decides which tools to use.
          return askAgent({ data: { sessionId, request: command, lines: [thisLine] } })
            .then(({ jobId }) => dispatch({ type: 'job', utteranceId: id, jobId }))
            .catch((err: unknown) => dispatch({ type: 'failed', utteranceId: id, error: err instanceof Error ? err.message : String(err) }))
        })
    },
    [meetingInfo, sessionId, trayItems, openTrayItem, pushToSession, send],
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
    syncSession({ data: { sessionId: fresh, title: meetingInfo.title, lines: [], reset: true } }).catch(() => {})
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
      if (e.code === 'Space') {
        e.preventDefault()
        stepScenario()
      } else if (e.key === 'Escape') {
        dispatch({ type: 'dismiss' })
      } else if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
        setDebug((d) => !d)
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
  const currentCard = state.current?.kind === 'card' ? cardById(state.current.id) : undefined
  const currentPerson = state.current?.kind === 'person' ? personCardById(state.current.id) : undefined
  const currentEntry = state.current?.kind === 'result' ? state.results[state.current.id] : undefined
  const entryVisible = currentEntry && !(currentEntry.status === 'error' && (currentEntry.error === 'person' || currentEntry.error === 'ui'))
  const showing = Boolean(state.current && (currentCard || currentPerson || entryVisible))
  const trigger = state.current ? state.utterances.find((u) => u.id === state.current!.utteranceId) : undefined
  const triggeredBy = trigger ? { speaker: trigger.speaker, text: trigger.text } : undefined
  const live = listening || playing
  const transcript = useMemo(() => toLines(state.utterances), [state.utterances])

  const orbState: OrbState = state.thinking > 0 ? 'thinking' : state.armed ? 'speaking' : live ? 'listening' : 'idle'
  const status = state.thinking > 0 ? 'Sprawdzam' : state.armed ? `${ASSISTANT_NAME} słucha` : speech.status === 'connecting' ? 'Łączę' : live ? `Czekam na „${ASSISTANT_NAME}”` : 'Gotowy'
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

        {/* Left: what moved to the background. */}
        <Tray items={trayItems} onOpen={openTrayItem} className="absolute top-1/2 left-4 z-20 w-56 -translate-y-1/2 md:left-6" />

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
              {currentEntry?.status === 'loading' && <AgentLoadingView question={currentEntry.question} activity={currentEntry.activity} steps={currentEntry.steps} triggeredBy={triggeredBy} />}
              {currentEntry?.status === 'error' && entryVisible && <AgentErrorView question={currentEntry.question} error={currentEntry.error} />}
              {currentEntry?.status === 'done' && currentEntry.result.kind === 'agent' && (
                <AgentCardView result={currentEntry.result} transcript={transcript} drafts={state.drafts} onSendDraft={(id) => send(id)} sendingDraft={sendingDraft} triggeredBy={triggeredBy} debug={debug} />
              )}
              {currentEntry?.status === 'done' && currentEntry.result.kind === 'task' && <ReportCardView task={currentEntry.result} triggeredBy={triggeredBy} debug={debug} />}
              {currentEntry?.status === 'done' && currentEntry.result.kind === 'sent' && <EmailSentView draft={currentEntry.result.draft} triggeredBy={triggeredBy} />}
            </div>
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
