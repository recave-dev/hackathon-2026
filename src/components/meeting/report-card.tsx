import { FileTextIcon, GlobeIcon } from 'lucide-react'

import { Pill } from '@/components/desktop/page'
import { Markdown } from '@/components/meeting/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { TaskResult } from '@/server/meeting-assist'
import { cn } from '@/lib/utils'

/** A background task: a spinner while it runs, the rendered document when it lands. */
export function ReportCardView({ task, triggeredBy, debug, className }: { task: TaskResult; triggeredBy?: { speaker: string; text: string }; debug?: boolean; className?: string }) {
  const running = task.status === 'queued' || task.status === 'running'
  const seconds = Math.round(((task.finishedAt ?? Date.now()) - task.startedAt) / 1000)
  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite" aria-busy={running}>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">
            {task.category === 'website' ? <GlobeIcon className="size-3" /> : <FileTextIcon className="size-3" />} {task.category === 'website' ? 'Strona' : 'Raport'}
          </Pill>
          {running && (
            <span className="inline-flex items-center gap-1.5">
              <Spinner className="size-3" /> {task.label}…
            </span>
          )}
          {task.status === 'done' && <span>gotowy po {seconds} s</span>}
          {task.status === 'failed' && <Pill tone="destructive">nie udało się</Pill>}
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{task.title ?? task.question}</h1>
        {triggeredBy && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-border bg-card p-6">
        {running && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <p className="text-sm text-muted-foreground">Piszę w tle. Możesz w tym czasie pytać o inne rzeczy; dam znać, gdy skończę.</p>
          </div>
        )}
        {task.status === 'failed' && <p className="text-base text-destructive">{task.error}</p>}
        {task.status === 'done' && task.markdown && <Markdown text={task.markdown} />}
      </section>

      {debug && task.model && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {task.model} · {task.taskId}
        </p>
      )}
    </article>
  )
}
