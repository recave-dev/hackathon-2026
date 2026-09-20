import { FileTextIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Pill } from '@/components/desktop/page'
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
            <FileTextIcon className="size-3" /> Raport
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

/** Just enough Markdown for a board memo: headings, paragraphs, bullets, numbered lists, tables, bold. */
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  let i = 0
  let key = 0
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => (part.startsWith('**') && part.endsWith('**') ? <strong key={idx}>{part.slice(2, -2)}</strong> : part))

  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="border-border" />)
      i++
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]!.length
      const cls = level <= 2 ? 'text-xl font-semibold tracking-tight mt-2' : 'text-base font-semibold mt-1'
      blocks.push(
        <p key={key++} className={cls}>
          {inline(heading[2]!)}
        </p>,
      )
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) items.push(lines[i]!.replace(/^\s*[-*]\s+/, '')), i++
      blocks.push(
        <ul key={key++} className="flex flex-col gap-1 pl-1 text-base leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2.5">
              <span aria-hidden className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{inline(it)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push(lines[i]!.replace(/^\s*\d+[.)]\s+/, '')), i++
      blocks.push(
        <ol key={key++} className="flex list-decimal flex-col gap-1 pl-6 text-base leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx}>{inline(it)}</li>
          ))}
        </ol>,
      )
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const cells = lines[i]!.trim().slice(1, -1).split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table className="w-full text-sm">
            {head && (
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {head.map((c, idx) => (
                    <th key={idx} className="py-1.5 pr-4">
                      {inline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-border/60 last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="py-1.5 pr-4 align-top tabular-nums">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|\s*[-*]\s|\s*\d+[.)]\s|\||\s*(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i]!)) para.push(lines[i]!), i++
    blocks.push(
      <p key={key++} className="text-base leading-relaxed">
        {inline(para.join(' '))}
      </p>,
    )
  }
  return <div className="flex flex-col gap-3">{blocks}</div>
}
