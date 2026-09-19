import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, ScaleIcon, SquareCheckIcon, StickyNoteIcon, XIcon } from 'lucide-react'

import { EmptyHint } from '@/components/app/screen'
import { firstName, formatDue } from '@/demo/format'
import { openTasks, pendingDecisions, personName, projectLabel } from '@/demo/selectors'
import { useDemoState } from '@/demo/store'
import type { ScreenArtifact } from '@/lib/voice/agent-tools'
import { cn } from '@/lib/utils'

/** Whatever the voice agent chose to put on screen, rendered under the orb. */
export function VoiceArtifact({ artifact, onClose }: { artifact: ScreenArtifact; onClose: () => void }) {
  const state = useDemoState()

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Pokazane przez agenta"
      className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-4 shadow-lg backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
    >
      <header className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">{heading(artifact)}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="rounded-full p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <XIcon className="size-4" />
        </button>
      </header>

      {artifact.kind === 'decision' && <DecisionBody id={artifact.id} />}

      {artifact.kind === 'decisions' && (
        <Rows
          empty="Nie ma spraw do decyzji."
          items={pendingDecisions(state).map((d) => ({
            key: d.id,
            icon: ScaleIcon,
            title: d.title,
            meta: `${projectLabel(state, d.projectId)} · ${formatDue(d.dueAt, state.now)}`,
            to: d.id,
          }))}
        />
      )}

      {artifact.kind === 'tasks' && (
        <Rows
          empty="Zespół nie ma otwartych zadań."
          items={openTasks(state).map((t) => ({
            key: t.id,
            icon: SquareCheckIcon,
            title: t.title,
            meta: `${firstName(personName(state, t.ownerId))} · ${formatDue(t.dueAt, state.now)}`,
          }))}
        />
      )}

      {artifact.kind === 'note' && (
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <StickyNoteIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            {artifact.title && <p className="text-sm font-medium">{artifact.title}</p>}
            <p className="text-sm leading-relaxed text-muted-foreground">{artifact.text}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function heading(artifact: ScreenArtifact): string {
  switch (artifact.kind) {
    case 'decision':
      return 'Sprawa do decyzji'
    case 'decisions':
      return 'Do decyzji'
    case 'tasks':
      return 'Zadania zespołu'
    case 'note':
      return 'Notatka'
  }
}

function DecisionBody({ id }: { id: string }) {
  const state = useDemoState()
  const decision = state.decisions.find((d) => d.id === id)
  if (!decision) return <EmptyHint>Nie znaleziono sprawy.</EmptyHint>
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-base leading-snug font-semibold tracking-tight text-balance">{decision.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {projectLabel(state, decision.projectId)} · {formatDue(decision.dueAt, state.now)}
        </p>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{decision.why}</p>
      {decision.options.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {decision.options.map((o) => (
            <li key={o.id} className="rounded-xl bg-accent/60 px-3 py-2 text-sm">
              <span className="font-medium">{o.label}</span>
              {o.consequences.cost && <span className="text-muted-foreground"> · {o.consequences.cost}</span>}
              {o.consequences.time && <span className="text-muted-foreground"> · {o.consequences.time}</span>}
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/app/decisions/$decisionId"
        params={{ decisionId: decision.id }}
        className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary outline-none focus-visible:underline"
      >
        Otwórz sprawę
        <ChevronRightIcon className="size-4" />
      </Link>
    </div>
  )
}

interface Row {
  key: string
  icon: typeof ScaleIcon
  title: string
  meta: string
  /** Decision id to link to; tasks have no detail page. */
  to?: string
}

function Rows({ items, empty }: { items: Row[]; empty: string }) {
  if (items.length === 0) return <EmptyHint className="py-5">{empty}</EmptyHint>
  return (
    <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
      {items.map((row) => {
        const Icon = row.icon
        const body = (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{row.title}</span>
              <span className="text-xs text-muted-foreground">{row.meta}</span>
            </span>
          </>
        )
        const className = 'flex items-center gap-3 rounded-2xl px-2 py-1.5'
        return (
          <li key={row.key}>
            {row.to ? (
              <Link
                to="/app/decisions/$decisionId"
                params={{ decisionId: row.to }}
                className={cn(className, 'group outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50')}
              >
                {body}
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
