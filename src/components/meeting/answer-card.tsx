import { ArrowUpRightIcon, DatabaseIcon, FileTextIcon, HashIcon, MailIcon, TableIcon, UsersIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import { Panel, Pill } from '@/components/desktop/page'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDayMonth } from '@/demo/format'
import type { KnowledgeCard } from '@/demo/knowledge'
import type { Citation, GraphAnswer } from '@/server/meeting-assist'
import { cn } from '@/lib/utils'

export type AnswerEntry = { status: 'loading'; question: string } | { status: 'done'; answer: GraphAnswer } | { status: 'error'; question: string; error: string }

const KIND_ICON: Record<Citation['kind'], ComponentType<{ className?: string }>> = {
  meeting_note: UsersIcon,
  note: FileTextIcon,
  slack: HashIcon,
  email: MailIcon,
  external: FileTextIcon,
  kpi: TableIcon,
  decision_record: FileTextIcon,
  support_ticket: FileTextIcon,
  agent_report: FileTextIcon,
}

const CONFIDENCE_LABEL: Record<GraphAnswer['confidence'], string> = { high: 'pewne', medium: 'prawdopodobne', low: 'niepewne' }

/** An open question answered from the whole company graph, with the passages it rests on. */
export function AnswerCardView({
  entry,
  triggeredBy,
  relatedCard,
  onOpenCard,
  debug,
  className,
}: {
  entry: AnswerEntry
  triggeredBy?: { speaker: string; text: string }
  relatedCard?: KnowledgeCard
  onOpenCard?: (cardId: string) => void
  debug?: boolean
  className?: string
}) {
  const question = entry.status === 'done' ? entry.answer.question : entry.question
  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite" aria-busy={entry.status === 'loading'}>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">
            <DatabaseIcon className="size-3" /> Z danych firmy
          </Pill>
          {entry.status === 'done' && <span>{CONFIDENCE_LABEL[entry.answer.confidence]}</span>}
          {entry.status === 'done' && !entry.answer.found && <Pill tone="destructive">brak w danych</Pill>}
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{question}</h1>
        {triggeredBy && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
          </p>
        )}
      </header>

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        {entry.status === 'loading' && (
          <>
            <div className="flex min-w-[10rem] flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-12 w-40" />
            </div>
            <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <p className="text-sm text-muted-foreground">Przeszukuję graf firmy…</p>
            </div>
          </>
        )}
        {entry.status === 'error' && (
          <p className="text-base leading-relaxed text-destructive md:col-span-2">
            Nie udało się odpytać danych: {entry.error}
          </p>
        )}
        {entry.status === 'done' && (
          <>
            {entry.answer.headline ? (
              <div className="flex min-w-[10rem] flex-col">
                <span className="text-xs text-muted-foreground">Odpowiedź</span>
                <span className="text-5xl font-semibold tracking-tight tabular-nums text-balance">{entry.answer.headline}</span>
              </div>
            ) : (
              <div className="hidden md:block" />
            )}
            <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
              <p className="text-xl leading-relaxed text-pretty">{entry.answer.answer}</p>
              {entry.answer.bullets.length > 0 && (
                <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
                  {entry.answer.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {relatedCard && onOpenCard && (
                <button
                  type="button"
                  onClick={() => onOpenCard(relatedCard.id)}
                  className="flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  Pokaż kartę: {relatedCard.title} <ArrowUpRightIcon className="size-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {entry.status === 'done' && entry.answer.citations.length > 0 && (
        <Panel title="Na czym to opieram" caption="Fragmenty źródeł z grafu firmy, które odpowiedź cytuje.">
          <ol className="flex flex-col gap-2">
            {entry.answer.citations.map((c) => {
              const Icon = KIND_ICON[c.kind] ?? FileTextIcon
              return (
                <li key={c.id} className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-[11px] text-muted-foreground">{c.id}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden />
                      <span className="truncate">{c.path.replace(/^knowledge\/synthetic\//, '')}</span>
                      {c.heading && <span>› {c.heading}</span>}
                      {c.date && <span>· {formatDayMonth(c.date)}</span>}
                    </p>
                    <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed whitespace-pre-line text-foreground/85">{c.quote}</blockquote>
                  </div>
                </li>
              )
            })}
          </ol>
        </Panel>
      )}

      {debug && entry.status === 'done' && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {entry.answer.model} · {entry.answer.latencyMs} ms · graf: {entry.answer.retrieval.nodes} węzłów, {entry.answer.retrieval.edges} krawędzi, {entry.answer.retrieval.chunks} fragmentów w kontekście
        </p>
      )}
    </article>
  )
}
