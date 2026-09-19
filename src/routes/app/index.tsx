import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronDownIcon, ChevronRightIcon, ScaleIcon, SquareCheckIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { toast } from '@/components/ui/toast'
import { firstName, formatDue, formatDuration, plural } from '@/demo/format'
import { openTasks, pendingDecisions, personName } from '@/demo/selectors'
import { SCRIPTED_TRANSCRIPT } from '@/demo/seed'
import { actions, getDemoState, useDemoState } from '@/demo/store'
import type { DemoState, Id, SessionPhase } from '@/demo/types'
import { cn } from '@/lib/utils'
import type { OrbState } from '@/registry/lib/orb-state'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'

export const Route = createFileRoute('/app/')({ component: AppScreen })

export const ORB_COLORS = { from: '#9db0ea', to: '#bfe6e6' } as const

const PROCESSING_MS = 2400
const MAX_ITEMS = 3

const SESSION_ORB: Record<SessionPhase, OrbState> = {
  idle: 'idle',
  recording: 'listening',
  paused: 'connecting',
  processing: 'thinking',
  review: 'thinking',
  saved: 'idle',
}

type TalkPhase = 'off' | 'connecting' | 'speaking' | 'listening' | 'thinking'

const TALK_ORB: Record<TalkPhase, OrbState> = {
  off: 'idle',
  connecting: 'connecting',
  speaking: 'speaking',
  listening: 'listening',
  thinking: 'thinking',
}

/** Scripted voice exchange: the agent speaks, waits, "thinks", then continues until it runs out of lines. */
function useAgentTalk(lines: string[]) {
  const [phase, setPhase] = useState<TalkPhase>('off')
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    if (phase === 'off') return
    let delay: number
    let next: () => void
    switch (phase) {
      case 'connecting':
        delay = 700
        next = () => setPhase('speaking')
        break
      case 'speaking':
        delay = 900 + (lines[lineIndex]?.length ?? 0) * 45
        next = () => setPhase('listening')
        break
      case 'listening':
        delay = 3200
        next = () => {
          if (lineIndex + 1 < lines.length) setPhase('thinking')
        }
        break
      case 'thinking':
        delay = 1100
        next = () => {
          setLineIndex((i) => i + 1)
          setPhase('speaking')
        }
        break
    }
    const id = window.setTimeout(next, delay)
    return () => window.clearTimeout(id)
  }, [phase, lineIndex, lines])

  return {
    phase,
    active: phase !== 'off',
    line: phase === 'speaking' || phase === 'listening' ? lines[lineIndex] : undefined,
    start: () => {
      setLineIndex(0)
      setPhase('connecting')
    },
    stop: () => setPhase('off'),
  }
}

function agentLines(state: DemoState): string[] {
  const pending = pendingDecisions(state)
  const tasks = openTasks(state)
  const first = pending[0]
  const task = tasks[0]
  return [
    first
      ? `Masz ${pending.length} ${plural(pending.length, 'sprawę', 'sprawy', 'spraw')} do decyzji. Najpilniejsza: ${first.title}, ${formatDue(first.dueAt, state.now)}.`
      : 'Nie masz dziś spraw do decyzji.',
    task ? `${firstName(personName(state, task.ownerId))} pracuje nad: ${task.title}.` : 'Zespół nie ma otwartych zadań.',
    'Coś jeszcze?',
  ]
}

type ActionItem = {
  id: Id
  kind: 'decision' | 'task'
  title: string
  meta: string
}

function actionItems(state: DemoState): { items: ActionItem[]; more: boolean } {
  const decisions = pendingDecisions(state).sort((a, b) => Number(Boolean(b.originNoteId)) - Number(Boolean(a.originNoteId)))
  const tasks = openTasks(state).sort((a, b) => Number(Boolean(b.noteId)) - Number(Boolean(a.noteId)))
  const all: ActionItem[] = [
    ...decisions.map((d) => ({ id: d.id, kind: 'decision' as const, title: d.title, meta: formatDue(d.dueAt, state.now) })),
    ...tasks.map((t) => ({
      id: t.id,
      kind: 'task' as const,
      title: t.title,
      meta: `${firstName(personName(state, t.ownerId))} · ${formatDue(t.dueAt, state.now)}`,
    })),
  ]
  return { items: all.slice(0, MAX_ITEMS), more: all.length > MAX_ITEMS }
}

function AppScreen() {
  const state = useDemoState()
  const { session } = state
  const { phase } = session
  const itemsRef = useRef<HTMLElement>(null)

  const lines = useMemo(() => agentLines(state), [state])
  const talk = useAgentTalk(lines)
  const { items, more } = useMemo(() => actionItems(state), [state])

  const isLive = phase === 'recording' || phase === 'paused'
  const isBusy = isLive || phase === 'processing'
  const scriptDone = session.revealed >= SCRIPTED_TRANSCRIPT.length
  const lastSegment = SCRIPTED_TRANSCRIPT[session.revealed - 1]

  useEffect(() => {
    if (phase !== 'recording') return
    const id = window.setInterval(() => actions.tick(), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'recording' || !scriptDone) return
    const id = window.setTimeout(() => actions.stopRecording(), 1500)
    return () => window.clearTimeout(id)
  }, [phase, scriptDone])

  // No separate review screen: extracted items are saved straight into the list below the fold.
  useEffect(() => {
    if (phase === 'saved') {
      actions.newSession()
      return
    }
    if (phase !== 'processing' && phase !== 'review') return
    const finish = () => {
      if (getDemoState().session.phase === 'processing') actions.finishProcessing()
      const created = getDemoState().session.items.filter((i) => i.included && (i.kind === 'task' || i.kind === 'decision')).length
      actions.saveSession('shared')
      actions.newSession()
      toast.add({
        type: 'success',
        title: 'Zapisano',
        description: `${created} ${plural(created, 'nowy element', 'nowe elementy', 'nowych elementów')} do działania.`,
      })
      itemsRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    const id = window.setTimeout(finish, phase === 'processing' ? PROCESSING_MS : 0)
    return () => window.clearTimeout(id)
  }, [phase])

  const orbState: OrbState = talk.active ? TALK_ORB[talk.phase] : SESSION_ORB[phase]
  const caption = talk.active
    ? talk.phase === 'connecting'
      ? 'Łączę…'
      : talk.phase === 'thinking'
        ? '…'
        : talk.line
    : isLive
      ? lastSegment?.text ?? 'Słucham…'
      : phase === 'processing'
        ? 'Porządkuję…'
        : undefined

  const toggleTalk = () => (talk.active ? talk.stop() : talk.start())
  const toggleRecord = () => (isLive ? actions.stopRecording() : actions.startRecording())

  return (
    <div className="h-svh snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none]">
      <section className="relative flex h-svh snap-start flex-col items-center justify-center gap-10 px-6">
        <div className="flex flex-col items-center gap-6">
          <button
            type="button"
            onClick={toggleTalk}
            disabled={isBusy}
            aria-pressed={talk.active}
            aria-label={talk.active ? 'Zakończ rozmowę z agentem' : 'Rozmawiaj z agentem'}
            className="rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-safe:active:scale-95 disabled:cursor-default"
          >
            <NebulaOrb state={orbState} size={220} colorFrom={ORB_COLORS.from} colorTo={ORB_COLORS.to} label="" className="pointer-events-none" />
          </button>

          <p
            role="status"
            aria-live="polite"
            className={cn(
              'min-h-10 max-w-xs text-center text-sm leading-relaxed text-muted-foreground transition-opacity duration-300',
              caption ? 'opacity-100' : 'opacity-0',
            )}
          >
            {caption}
          </p>
        </div>

        <button
          type="button"
          onClick={toggleRecord}
          disabled={talk.active || phase === 'processing'}
          aria-label={isLive ? 'Zakończ transkrypcję' : 'Rozpocznij transkrypcję'}
          className="group flex flex-col items-center gap-2 outline-none disabled:opacity-40"
        >
          <span
            className={cn(
              'flex size-16 items-center justify-center rounded-full border-2 border-foreground/20 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring/60',
              isLive && 'border-red-400/60',
            )}
          >
            <span
              className={cn(
                'bg-red-500 transition-all duration-300',
                isLive ? 'size-6 rounded-md' : 'size-7 rounded-full motion-safe:group-hover:scale-105',
              )}
            />
          </span>
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            {isLive ? <span className="font-mono tabular-nums">{formatDuration(session.elapsedSec)}</span> : 'Transcribe'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => itemsRef.current?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Pokaż elementy do działania"
          className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full p-2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <ChevronDownIcon className="size-7 motion-safe:animate-bounce" />
        </button>
      </section>

      <section
        ref={itemsRef}
        className="flex min-h-svh snap-start flex-col gap-4 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <header className="flex items-baseline justify-between px-0.5">
          <h2 className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Do działania</h2>
          {more && (
            <Link to="/app/decisions" className="text-xs font-medium text-primary outline-none focus-visible:underline">
              Wszystkie
            </Link>
          )}
        </header>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">Nic do działania.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <ActionCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ActionCard({ item }: { item: ActionItem }) {
  const Icon = item.kind === 'decision' ? ScaleIcon : SquareCheckIcon
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{item.title}</span>
        <span className="text-xs text-muted-foreground">{item.meta}</span>
      </span>
    </>
  )
  const className = 'flex items-center gap-3 rounded-2xl border border-border bg-card p-4'

  if (item.kind === 'decision') {
    return (
      <Link
        to="/app/decisions/$decisionId"
        params={{ decisionId: item.id }}
        className={cn(className, 'group transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50')}
      >
        {body}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}
