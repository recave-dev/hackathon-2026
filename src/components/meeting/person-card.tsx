import { ArrowUpRightIcon, BriefcaseIcon, ClockIcon, InfoIcon } from 'lucide-react'

import { SourceList } from '@/components/app/sources'
import { Panel, Pill, initials } from '@/components/desktop/page'
import { formatDayMonth } from '@/demo/format'
import { cardById } from '@/demo/knowledge'
import type { PersonCard } from '@/demo/people'
import { cn } from '@/lib/utils'

/** "Who is X": one person, what they own, what they are on right now. */
export function PersonCardView({
  person,
  triggeredBy,
  onOpenCard,
  className,
}: {
  person: PersonCard
  triggeredBy?: { speaker: string; text: string }
  /** Jump from a current item to its knowledge card. */
  onOpenCard?: (cardId: string) => void
  className?: string
}) {
  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite">
      <header className="flex items-start gap-5">
        <span aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-accent text-2xl font-semibold text-accent-foreground">
          {initials(person.name)}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Pill tone="accent">Osoba</Pill>
            <span>{person.team}</span>
          </div>
          <h1 className="text-4xl leading-none font-semibold tracking-tight text-balance">{person.name}</h1>
          <p className="text-lg text-muted-foreground">{person.role}</p>
          {triggeredBy && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
            </p>
          )}
        </div>
      </header>

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-1">
          {person.facts.map((fact) => (
            <div key={fact.label} className="flex flex-col">
              <dt className="text-[11px] text-muted-foreground">{fact.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{fact.value}</dd>
              {fact.hint && <dd className="text-[11px] text-muted-foreground">{fact.hint}</dd>}
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
          <p className="text-xl leading-relaxed text-pretty">{person.summary}</p>
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Za co odpowiada</p>
            <ul className="grid gap-1.5 text-sm leading-relaxed sm:grid-cols-2">
              {person.owns.map((item) => (
                <li key={item} className="flex gap-2">
                  <BriefcaseIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Nad czym pracuje teraz" caption="Sprawy otwarte na dziś. Kliknij, żeby zobaczyć kartę tematu.">
            <ol className="flex flex-col gap-2">
              {person.current.map((item) => {
                const card = cardById(item.cardId)
                const Inner = (
                  <>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-sm font-medium leading-snug">{item.title}</p>
                      <p className="text-sm leading-relaxed text-foreground/85">{item.detail}</p>
                      {card && <p className="text-xs text-muted-foreground">Temat: {card.title}</p>}
                    </div>
                    {card && onOpenCard && <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  </>
                )
                return (
                  <li key={item.title}>
                    {card && onOpenCard ? (
                      <button type="button" onClick={() => onOpenCard(card.id)} className="flex w-full items-start gap-3 rounded-xl border border-border bg-background/40 p-3 text-left transition-colors hover:bg-muted">
                        {Inner}
                      </button>
                    ) : (
                      <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">{Inner}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          </Panel>

          <Panel title="Ostatnio">
            <ol className="flex flex-col divide-y divide-border">
              {person.recent.map((item) => (
                <li key={`${item.at}-${item.title}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <ClockIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm font-medium leading-snug">
                      {item.title}
                      {item.at && <span className="font-normal text-muted-foreground"> · {formatDayMonth(item.at)}</span>}
                    </p>
                    <p className="text-sm leading-relaxed text-foreground/85">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Panel title="Warto wiedzieć">
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {person.notes.map((note) => (
                <li key={note} className="flex gap-2.5">
                  <InfoIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Źródła" caption="Skąd to wiemy.">
            <SourceList sourceIds={person.sourceIds} />
          </Panel>
        </aside>
      </div>
    </article>
  )
}
