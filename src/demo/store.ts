import { useSyncExternalStore } from 'react'

import { addMinutes } from './format'
import {
  SCRIPTED_ITEMS,
  SCRIPTED_SUMMARY,
  SCRIPTED_TRANSCRIPT,
  STATE_VERSION,
  buildAlfaTrainingDecision,
  createSeedState,
  createSession,
} from './seed'
import type {
  Activity,
  Decision,
  DemoState,
  ExecutionStep,
  Id,
  Note,
  Question,
  SessionMode,
  Source,
  Task,
} from './types'

const STORAGE_KEY = 'droker-demo-state'

/** Stable snapshot for SSR and the first hydration pass. */
const SERVER_STATE: DemoState = createSeedState()

let state: DemoState = SERVER_STATE
let loaded = false
const listeners = new Set<() => void>()

const canPersist = () => typeof window !== 'undefined' && 'localStorage' in window

function load(): void {
  if (loaded) return
  loaded = true
  if (!canPersist()) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as DemoState
    if (parsed.version !== STATE_VERSION) return
    // A recording cannot survive a reload, but its progress can: resume paused.
    if (parsed.session.phase === 'recording') parsed.session = { ...parsed.session, phase: 'paused' }
    state = parsed
  } catch {
    state = createSeedState()
  }
}

function persist(): void {
  if (!canPersist()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage may be full or blocked; the demo keeps working in memory.
  }
}

function setState(next: DemoState): void {
  if (next === state) return
  state = next
  persist()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): DemoState {
  load()
  return state
}

export const useDemoState = (): DemoState =>
  useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE)

const noop = () => () => {}

/**
 * False during SSR and the hydration pass, true afterwards. Screens hide until
 * then so the seed state rendered on the server never flashes before the
 * persisted demo state takes over.
 */
export const useHydrated = (): boolean =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )

export const getDemoState = (): DemoState => getSnapshot()

let counter = 0
const uid = (prefix: string): Id => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** Every user action nudges the demo clock forward so feeds stay ordered. */
const ACTION_MINUTES = 3

function update(recipe: (draft: DemoState, now: string) => DemoState | void): void {
  load()
  const now = addMinutes(state.now, ACTION_MINUTES)
  const draft: DemoState = { ...state, now }
  const result = recipe(draft, now)
  setState(result ?? draft)
}

const pushActivity = (draft: DemoState, activity: Omit<Activity, 'id' | 'at'>, at: string): void => {
  draft.activities = [{ id: uid('act'), at, ...activity }, ...draft.activities]
}

const replaceDecision = (draft: DemoState, next: Decision): void => {
  draft.decisions = draft.decisions.map((d) => (d.id === next.id ? next : d))
}

export const actions = {
  resetDemo(): void {
    load()
    setState(createSeedState())
  },

  setSessionMode(mode: SessionMode): void {
    update((draft) => {
      if (draft.session.phase !== 'idle') return
      draft.session = { ...draft.session, mode }
    })
  },

  startRecording(): void {
    update((draft) => {
      if (draft.session.phase !== 'idle') return
      draft.session = { ...draft.session, phase: 'recording', elapsedSec: 0, revealed: 0 }
    })
  },

  pauseRecording(): void {
    update((draft) => {
      if (draft.session.phase !== 'recording') return
      draft.session = { ...draft.session, phase: 'paused' }
    })
  },

  resumeRecording(): void {
    update((draft) => {
      if (draft.session.phase !== 'paused') return
      draft.session = { ...draft.session, phase: 'recording' }
    })
  },

  /** One second of simulated recording: advances the timer and reveals due segments. */
  tick(): void {
    load()
    if (state.session.phase !== 'recording') return
    const elapsedSec = state.session.elapsedSec + 1
    const revealed = SCRIPTED_TRANSCRIPT.filter((s) => s.at <= elapsedSec).length
    setState({ ...state, session: { ...state.session, elapsedSec, revealed } })
  },

  stopRecording(): void {
    update((draft) => {
      const { phase } = draft.session
      if (phase !== 'recording' && phase !== 'paused') return
      // Everything said so far counts, even if the user stopped mid-script.
      draft.session = { ...draft.session, phase: 'processing' }
    })
  },

  finishProcessing(): void {
    update((draft) => {
      if (draft.session.phase !== 'processing') return
      const spoken = new Set(SCRIPTED_TRANSCRIPT.slice(0, draft.session.revealed).map((s) => s.id))
      const items = structuredClone(SCRIPTED_ITEMS).filter((i) => spoken.has(i.segmentId))
      draft.session = { ...draft.session, phase: 'review', items, summary: SCRIPTED_SUMMARY }
    })
  },

  updateItemText(itemId: Id, text: string): void {
    update((draft) => {
      draft.session = {
        ...draft.session,
        items: draft.session.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
      }
    })
  },

  setItemIncluded(itemId: Id, included: boolean): void {
    update((draft) => {
      draft.session = {
        ...draft.session,
        items: draft.session.items.map((i) => (i.id === itemId ? { ...i, included } : i)),
      }
    })
  },

  updateSummary(summary: string): void {
    update((draft) => {
      draft.session = { ...draft.session, summary }
    })
  },

  /**
   * Saves the reviewed session as a note. Shared notes also feed the team state:
   * tasks, decisions, changes and agent activity. Saving twice is a no-op.
   */
  saveSession(visibility: Note['visibility']): void {
    update((draft, now) => {
      const session = draft.session
      if (session.phase !== 'review') return
      const existing = draft.notes.find((n) => n.sessionId === session.id)
      if (existing) {
        draft.session = { ...session, phase: 'saved', savedNoteId: existing.id }
        return
      }

      const noteId = uid('note')
      const segments = SCRIPTED_TRANSCRIPT.slice(0, session.revealed)
      const accepted = session.items.filter((i) => i.included)
      const note: Note = {
        id: noteId,
        sessionId: session.id,
        mode: session.mode,
        visibility,
        createdAt: now,
        durationSec: session.elapsedSec,
        projectId: 'prj-alfa',
        summary: session.summary,
        segments,
        items: session.items,
        decisionIds: [],
        taskIds: [],
      }

      if (visibility === 'private') {
        draft.notes = [note, ...draft.notes]
        pushActivity(
          draft,
          { actor: 'user', text: 'Zapisano prywatną notatkę głosową (bez spraw dla zespołu).', link: { type: 'note', id: noteId } },
          now,
        )
        draft.session = { ...session, phase: 'saved', savedNoteId: noteId }
        return
      }

      const segmentText = (segmentId: Id) => segments.find((s) => s.id === segmentId)?.text ?? ''
      const sourceFor = (item: { segmentId: Id }, title: string): Source => ({
        id: uid('src'),
        kind: 'transcript',
        title,
        excerpt: segmentText(item.segmentId),
        date: now,
        author: 'Tomasz Kowalski (notatka głosowa)',
        noteId,
        segmentId: item.segmentId,
      })

      const newSources: Source[] = []
      const newTasks: Task[] = []
      const newDecisions: Decision[] = []

      for (const item of accepted) {
        if (item.kind === 'task') {
          const src = sourceFor(item, 'Notatka głosowa — zadanie')
          newSources.push(src)
          newTasks.push({
            id: uid('task'),
            title: item.text,
            ownerId: 'p-anna',
            dueAt: '2026-11-11T17:00:00',
            status: 'open',
            projectId: 'prj-alfa',
            noteId,
          })
        }
        if (item.kind === 'decision' && !draft.decisions.some((d) => d.id === 'dec-alfa-training')) {
          const src = sourceFor(item, 'Notatka głosowa — kwestia do decyzji')
          newSources.push(src)
          newDecisions.push(buildAlfaTrainingDecision(noteId, src.id, now))
        }
      }

      const integration = accepted.find((i) => i.id === 'item-integration')
      if (integration) {
        const src = sourceFor(integration, 'Notatka głosowa — ustalenie terminów')
        newSources.push(src)
        draft.changes = draft.changes.map((c) =>
          c.id === 'ch-alfa-conflict'
            ? {
                ...c,
                at: now,
                text: 'Konflikt terminu integracji z Alfą wyjaśniony według relacji CEO.',
                detail:
                  'Start podstawowych funkcji 15 listopada, integracja ERP 8 grudnia. Formalne potwierdzenie klienta nadal do uzyskania.',
                link: { type: 'note', id: noteId },
              }
            : c,
        )
        draft.meetings = draft.meetings.map((m) =>
          m.id === 'meet-alfa'
            ? {
                ...m,
                openIssues: [
                  'Konflikt terminu integracji wyjaśniony według relacji CEO (15 listopada start, 8 grudnia integracja) — potwierdzić na piśmie.',
                  ...m.openIssues.filter((i) => !i.startsWith('Konflikt terminu')),
                ],
                sourceIds: [...m.sourceIds, src.id],
              }
            : m,
        )
      }

      note.decisionIds = newDecisions.map((d) => d.id)
      note.taskIds = newTasks.map((t) => t.id)

      draft.sources = [...draft.sources, ...newSources]
      draft.tasks = [...newTasks, ...draft.tasks]
      draft.decisions = [...newDecisions, ...draft.decisions]
      draft.notes = [note, ...draft.notes]

      pushActivity(draft, { actor: 'agent', text: 'Notatka głosowa powiązana z projektem Alfa.', link: { type: 'note', id: noteId } }, now)
      for (const task of newTasks) {
        pushActivity(draft, { actor: 'agent', text: `Utworzono zadanie dla Anny: ${task.title}`, link: { type: 'note', id: noteId } }, addMinutes(now, 1))
      }
      for (const decision of newDecisions) {
        pushActivity(
          draft,
          { actor: 'agent', text: `Nowa sprawa do decyzji: ${decision.title}.`, link: { type: 'decision', id: decision.id } },
          addMinutes(now, 2),
        )
      }
      if (integration) {
        pushActivity(
          draft,
          { actor: 'agent', text: 'Konflikt terminów z Alfą oznaczono jako wyjaśniony (wg relacji CEO); brakuje potwierdzenia klienta.', link: { type: 'meeting', id: 'meet-alfa' } },
          addMinutes(now, 2),
        )
      }

      draft.session = { ...session, phase: 'saved', savedNoteId: noteId }
    })
  },

  newSession(): void {
    update((draft) => {
      draft.session = createSession(draft.session.mode)
    })
  },

  approveDecision(decisionId: Id, optionId: Id | 'custom', customInstruction?: string): void {
    update((draft, now) => {
      const decision = draft.decisions.find((d) => d.id === decisionId)
      if (!decision || decision.status !== 'pending') return

      const option = decision.options.find((o) => o.id === optionId)
      const steps: Omit<ExecutionStep, 'id'>[] = option
        ? option.execution
        : [
            { label: 'Instrukcja przekazana agentowi', status: 'done' },
            { label: 'Szkic działań przygotowany do Twojej akceptacji', status: 'waiting' },
          ]
      const execution: ExecutionStep[] = steps.map((s) => ({ ...s, id: uid('ex') }))

      replaceDecision(draft, {
        ...decision,
        status: 'decided',
        decidedAt: now,
        chosenOptionId: option?.id ?? 'custom',
        customInstruction: customInstruction?.trim() || undefined,
        execution,
      })

      const label = option ? option.label : 'własna instrukcja'
      pushActivity(draft, { actor: 'user', text: `Zatwierdzono: ${decision.title} — ${label}.`, link: { type: 'decision', id: decisionId } }, now)
      execution
        .filter((s) => s.status === 'done')
        .forEach((s, i) =>
          pushActivity(draft, { actor: 'agent', text: s.label, link: { type: 'decision', id: decisionId } }, addMinutes(now, i + 1)),
        )
    })
  },

  snoozeDecision(decisionId: Id, untilIso: string): void {
    update((draft, now) => {
      const decision = draft.decisions.find((d) => d.id === decisionId)
      if (!decision || (decision.status !== 'pending' && decision.status !== 'snoozed')) return
      replaceDecision(draft, { ...decision, status: 'snoozed', snoozedUntil: untilIso })
      pushActivity(draft, { actor: 'user', text: `Odłożono: ${decision.title}.`, link: { type: 'decision', id: decisionId } }, now)
    })
  },

  unsnoozeDecision(decisionId: Id): void {
    update((draft) => {
      const decision = draft.decisions.find((d) => d.id === decisionId)
      if (!decision || decision.status !== 'snoozed') return
      replaceDecision(draft, { ...decision, status: 'pending', snoozedUntil: undefined })
    })
  },

  delegateDecision(decisionId: Id, personId: Id, instruction?: string): void {
    update((draft, now) => {
      const decision = draft.decisions.find((d) => d.id === decisionId)
      const person = draft.people.find((p) => p.id === personId)
      if (!decision || !person || decision.status !== 'pending') return
      replaceDecision(draft, {
        ...decision,
        status: 'delegated',
        delegatedToId: personId,
        decidedAt: now,
        customInstruction: instruction?.trim() || undefined,
        execution: [
          { id: uid('ex'), label: `Sprawa przekazana wraz z kontekstem i źródłami. Odpowiada: ${person.name}`, status: 'done' },
          { id: uid('ex'), label: `Oczekiwanie na decyzję: ${person.name}`, status: 'waiting' },
        ],
      })
      pushActivity(draft, { actor: 'agent', text: `Sprawa „${decision.title}” delegowana. Odpowiada: ${person.name}.`, link: { type: 'decision', id: decisionId } }, now)
    })
  },

  askQuestion(decisionId: Id, toId: Id, text: string): void {
    update((draft, now) => {
      const decision = draft.decisions.find((d) => d.id === decisionId)
      const person = draft.people.find((p) => p.id === toId)
      if (!decision || !person || !text.trim()) return
      const question: Question = { id: uid('q'), text: text.trim(), toId, askedAt: now }
      replaceDecision(draft, { ...decision, questions: [...decision.questions, question] })
      pushActivity(draft, { actor: 'agent', text: `Pytanie wysłane (${person.name}): „${question.text}”`, link: { type: 'decision', id: decisionId } }, now)
    })
  },

  /** Simulated reply from the person a question was sent to. */
  answerQuestion(decisionId: Id, questionId: Id): void {
    update((draft, now) => {
      const decision = draft.decisions.find((d) => d.id === decisionId)
      if (!decision) return
      const question = decision.questions.find((q) => q.id === questionId)
      if (!question || question.answer) return
      const person = draft.people.find((p) => p.id === question.toId)
      const answer = simulatedAnswer(decision.id, question.toId)
      replaceDecision(draft, {
        ...decision,
        questions: decision.questions.map((q) => (q.id === questionId ? { ...q, answer, answeredAt: now } : q)),
      })
      pushActivity(draft, { actor: 'system', text: `${person?.name ?? 'Odpowiedź'}: ${answer}`, link: { type: 'decision', id: decisionId } }, now)
    })
  },
}

function simulatedAnswer(decisionId: Id, toId: Id): string {
  if (decisionId === 'dec-alfa-training') {
    return 'Alfa mówiła o 2 grupach po ok. 8 osób, po jednym dniu każda. Szczegóły potwierdzę po spotkaniu o 11:00.'
  }
  if (decisionId === 'dec-qa-vendor') {
    return 'Beta wcześniej schodziła ze stawki o 5–8% przy przedłużeniu na pół roku. Na 2 miesiące raczej nie.'
  }
  if (decisionId === 'dec-senior-offer') {
    return 'Druga oferta to podobno 25 000 zł plus opcje. Bonus roczny może go przekonać, ale nie mam pewności.'
  }
  if (toId === 'p-michal') return 'Z perspektywy budżetu mieścimy się, jeśli przesuniemy część kosztów na Q1.'
  return 'Sprawdzę i wrócę z odpowiedzią po południu (odpowiedź symulowana).'
}
