import {
  FileTextIcon,
  HashIcon,
  MailIcon,
  MicIcon,
  TableIcon,
  UsersIcon,
} from 'lucide-react'
import { useState, type ComponentType } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime, formatDayMonth, formatDuration } from '@/demo/format'
import { useDemoState } from '@/demo/store'
import type { Id, Source, SourceKind, TranscriptSegment } from '@/demo/types'
import { cn } from '@/lib/utils'

const KIND_META: Record<SourceKind, { label: string; icon: ComponentType<{ className?: string }> }> = {
  email: { label: 'E-mail', icon: MailIcon },
  document: { label: 'Dokument', icon: FileTextIcon },
  transcript: { label: 'Transkrypcja', icon: MicIcon },
  slack: { label: 'Slack', icon: HashIcon },
  kpi: { label: 'KPI', icon: TableIcon },
  meeting: { label: 'Spotkanie', icon: UsersIcon },
}

export function TranscriptDialog({
  open,
  onOpenChange,
  segments,
  highlightId,
  title = 'Fragment transkrypcji',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  segments: TranscriptSegment[]
  highlightId?: Id
  title?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Nagranie demonstracyjne — treść była przygotowana z góry.</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-1.5">
          {segments.map((segment) => {
            const active = segment.id === highlightId
            return (
              <li
                key={segment.id}
                ref={(el) => {
                  if (active && el) el.scrollIntoView({ block: 'center' })
                }}
                className={cn(
                  'flex gap-3 rounded-lg px-2.5 py-2 text-sm leading-relaxed',
                  active ? 'bg-accent text-accent-foreground' : 'text-foreground/80',
                )}
                aria-current={active ? 'true' : undefined}
              >
                <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDuration(segment.at)}
                </span>
                <span>{segment.text}</span>
              </li>
            )
          })}
        </ol>
      </DialogContent>
    </Dialog>
  )
}

/** Small "0:15" chip that opens the transcript at the given segment. */
export function SegmentLink({
  segments,
  segmentId,
  className,
}: {
  segments: TranscriptSegment[]
  segmentId: Id
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const segment = segments.find((s) => s.id === segmentId)
  if (!segment) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Pokaż źródło w transkrypcji, ${formatDuration(segment.at)}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none',
          className,
        )}
      >
        <MicIcon className="size-3" />
        {formatDuration(segment.at)}
      </button>
      <TranscriptDialog open={open} onOpenChange={setOpen} segments={segments} highlightId={segmentId} />
    </>
  )
}

export function SourceCard({ source }: { source: Source }) {
  const notes = useDemoState().notes
  const [open, setOpen] = useState(false)
  const meta = KIND_META[source.kind]
  const Icon = meta.icon
  const note = source.noteId ? notes.find((n) => n.id === source.noteId) : undefined
  const segment = note?.segments.find((s) => s.id === source.segmentId)

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-sm font-medium leading-snug">{source.title}</p>
          <p className="text-xs text-muted-foreground">
            {meta.label}
            {source.author ? ` · ${source.author}` : ''} · {source.kind === 'transcript' ? formatDateTime(source.date) : formatDayMonth(source.date)}
          </p>
        </div>
      </div>
      <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed text-foreground/85">
        {source.excerpt}
      </blockquote>
      {note && segment && (
        <>
          <Button variant="ghost" size="sm" className="w-fit -ml-1" onClick={() => setOpen(true)}>
            <MicIcon /> Otwórz fragment ({formatDuration(segment.at)})
          </Button>
          <TranscriptDialog
            open={open}
            onOpenChange={setOpen}
            segments={note.segments}
            highlightId={segment.id}
            title="Notatka głosowa — fragment"
          />
        </>
      )}
    </article>
  )
}

export function SourceList({ sourceIds }: { sourceIds: Id[] }) {
  const sources = useDemoState().sources
  const resolved = sourceIds.map((id) => sources.find((s) => s.id === id)).filter((s): s is Source => Boolean(s))
  if (resolved.length === 0) return <p className="text-sm text-muted-foreground">Brak źródeł.</p>
  return (
    <div className="flex flex-col gap-2">
      {resolved.map((source) => (
        <SourceCard key={source.id} source={source} />
      ))}
    </div>
  )
}
