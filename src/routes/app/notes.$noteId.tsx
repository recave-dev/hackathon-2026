import { Link, createFileRoute } from '@tanstack/react-router'
import { LockIcon, Share2Icon } from 'lucide-react'

import { Screen, Section } from '@/components/app/screen'
import { SegmentLink } from '@/components/app/sources'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatDuration } from '@/demo/format'
import { projectLabel } from '@/demo/selectors'
import { useDemoState, useHydrated } from '@/demo/store'
import type { ExtractedKind } from '@/demo/types'

export const Route = createFileRoute('/app/notes/$noteId')({ component: NoteView })

const KIND_LABEL: Record<ExtractedKind, string> = {
  agreement: 'Ustalenie',
  proposal: 'Propozycja',
  task: 'Zadanie',
  decision: 'Do decyzji',
  missing: 'Brakuje',
}

function NoteView() {
  const { noteId } = Route.useParams()
  const state = useDemoState()
  const hydrated = useHydrated()
  const note = state.notes.find((n) => n.id === noteId)
  // Notes live only in persisted client state; wait for it before declaring "not found".
  if (!note) return hydrated ? <Screen title="Nie znaleziono notatki" back={{ to: '/app', label: 'Start' }} /> : null
  const included = note.items.filter((i) => i.included)

  return (
    <Screen
      back={{ to: '/app', label: 'Start' }}
      eyebrow={`${note.mode === 'note' ? 'Notatka głosowa' : 'Nagranie spotkania'} · ${formatDateTime(note.createdAt)}`}
      title={note.projectId ? projectLabel(state, note.projectId) : 'Notatka'}
      description={
        <span className="inline-flex items-center gap-1.5">
          {note.visibility === 'private' ? <LockIcon className="size-3.5" /> : <Share2Icon className="size-3.5" />}
          {note.visibility === 'private' ? 'Prywatna — widoczna tylko dla Ciebie' : 'Przekazana zespołowi'} · {formatDuration(note.durationSec)}
        </span>
      }
    >
      <Section title="Podsumowanie">
        <p className="text-sm leading-relaxed">{note.summary}</p>
      </Section>

      <Section title="Wyodrębnione elementy">
        <ul className="flex flex-col gap-2">
          {included.map((item) => (
            <li key={item.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{KIND_LABEL[item.kind]}</span>
                <SegmentLink segments={note.segments} segmentId={item.segmentId} />
              </div>
              <p className="text-sm leading-relaxed">{item.text}</p>
              {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
            </li>
          ))}
        </ul>
      </Section>

      {note.decisionIds.length > 0 && (
        <Section title="Powiązane sprawy">
          {note.decisionIds.map((id) => {
            const decision = state.decisions.find((d) => d.id === id)
            return decision ? (
              <Button key={id} variant="outline" className="w-full" render={<Link to="/app/decisions/$decisionId" params={{ decisionId: id }} />}>
                {decision.title}
              </Button>
            ) : null
          })}
        </Section>
      )}

      <Section title="Transkrypcja">
        <ol className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          {note.segments.map((segment) => (
            <li key={segment.id} className="flex gap-3 text-sm leading-relaxed">
              <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{formatDuration(segment.at)}</span>
              <span>{segment.text}</span>
            </li>
          ))}
        </ol>
      </Section>
    </Screen>
  )
}
