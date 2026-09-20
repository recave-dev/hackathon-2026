import { BrainIcon, DatabaseIcon, ExternalLinkIcon, FileTextIcon, GlobeIcon, HashIcon, MailIcon, TableIcon, UsersIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import { Panel, Pill } from '@/components/desktop/page'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDayMonth } from '@/demo/format'
import { intentById, type Intent } from '@/lib/intents'
import type { AnswerResult, Citation } from '@/server/meeting-assist'
import { cn } from '@/lib/utils'

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

const SOURCE_PILL: Partial<Record<Intent, { label: string; icon: ComponentType<{ className?: string }> }>> = {
  data: { label: 'Z danych firmy', icon: DatabaseIcon },
  web: { label: 'Z internetu', icon: GlobeIcon },
  general: { label: 'Wiedza ogólna', icon: BrainIcon },
}

const CONFIDENCE_LABEL = { high: 'pewne', medium: 'prawdopodobne', low: 'niepewne' } as const

/** Shown while an action runs: the question, the intent Bolek picked, and a skeleton. */
export function AnswerLoadingView({ question, intent, triggeredBy }: { question: string; intent?: Intent; triggeredBy?: { speaker: string; text: string } }) {
  const spec = intentById(intent)
  const pill = intent ? SOURCE_PILL[intent] : undefined
  return (
    <article className="flex min-w-0 flex-col gap-5" aria-busy>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {pill ? (
            <Pill tone="accent">
              <pill.icon className="size-3" /> {pill.label}
            </Pill>
          ) : (
            <Pill tone="muted">Sprawdzam…</Pill>
          )}
          {spec && <span>{spec.label}…</span>}
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{question}</h1>
        {triggeredBy && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
          </p>
        )}
      </header>
      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex min-w-[10rem] flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-40" />
        </div>
        <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>
    </article>
  )
}

export function AnswerErrorView({ question, error }: { question: string; error: string }) {
  return (
    <article className="flex min-w-0 flex-col gap-5">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{question}</h1>
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-base leading-relaxed text-destructive">Nie udało się: {error}</p>
      </section>
    </article>
  )
}

/** A short answer from company data, general knowledge or the web, with what it rests on. */
export function AnswerCardView({ result, triggeredBy, debug, className }: { result: AnswerResult; triggeredBy?: { speaker: string; text: string }; debug?: boolean; className?: string }) {
  const pill = SOURCE_PILL[result.intent] ?? SOURCE_PILL.general!
  const graph = result.graph
  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">
            <pill.icon className="size-3" /> {pill.label}
          </Pill>
          {graph && <span>{CONFIDENCE_LABEL[graph.confidence]}</span>}
          {graph && !graph.found && <Pill tone="destructive">brak w danych</Pill>}
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{result.question}</h1>
        {triggeredBy && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
          </p>
        )}
      </header>

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        {result.headline ? (
          <div className="flex min-w-[10rem] max-w-md flex-col">
            <span className="text-xs text-muted-foreground">Odpowiedź</span>
            <span className="text-5xl font-semibold tracking-tight tabular-nums text-balance">{result.headline}</span>
          </div>
        ) : (
          <div className="hidden md:block" />
        )}
        <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
          <p className="text-xl leading-relaxed text-pretty">{result.answer}</p>
          {result.bullets.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
              {result.bullets.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {graph && graph.citations.length > 0 && (
        <Panel title="Na czym to opieram" caption="Fragmenty źródeł z grafu firmy, które odpowiedź cytuje.">
          <ol className="flex flex-col gap-2">
            {graph.citations.map((c) => {
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

      {result.sources.length > 0 && (
        <Panel title="Źródła w internecie" caption="Strony, które przeczytałem, odpowiadając.">
          <ul className="flex flex-col gap-1.5">
            {result.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
                  <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{s.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{new URL(s.url).hostname}</span>
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {debug && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {result.model} · {result.latencyMs} ms
          {graph && ` · graf: ${graph.retrieval.nodes} węzłów, ${graph.retrieval.edges} krawędzi, ${graph.retrieval.chunks} fragmentów`}
        </p>
      )}
    </article>
  )
}
