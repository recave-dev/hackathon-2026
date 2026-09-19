import { Link } from '@tanstack/react-router'
import { ArrowUpRightIcon, CalendarClockIcon, CheckIcon, CircleAlertIcon, GavelIcon, XIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import { SourceList } from '@/components/app/sources'
import { Panel, Pill, initials } from '@/components/desktop/page'
import { SpendChart } from '@/components/desktop/spend-chart'
import { formatDayMonth } from '@/demo/format'
import { CATEGORY_LABEL, FACET_LABEL, type CardEventKind, type Facet, type KnowledgeCard } from '@/demo/knowledge'
import { invoicesInWindow, spendWindow } from '@/demo/selectors'
import { useDemoState } from '@/demo/store'
import { cn } from '@/lib/utils'

const EVENT_ICON: Record<CardEventKind, ComponentType<{ className?: string }>> = {
  approved: CheckIcon,
  rejected: XIcon,
  decision: GavelIcon,
  deadline: CalendarClockIcon,
  note: CircleAlertIcon,
}

/**
 * The single thing on the meeting screen: one topic, answered from the angle
 * the room asked about. Everything else on the card is supporting detail.
 */
export function KnowledgeCardView({
  card,
  facet,
  triggeredBy,
  className,
}: {
  card: KnowledgeCard
  facet: Facet
  /** The utterance that put this card on screen, shown as a quote. */
  triggeredBy?: { speaker: string; text: string }
  className?: string
}) {
  const state = useDemoState()
  const answer = card.answers[facet] ?? card.answers.general
  const facts = [...card.facts].sort((a, b) => Number(b.facets.includes(facet)) - Number(a.facets.includes(facet)))
  const lead = facts[0]
  const rest = facts.slice(1)
  const peopleFirst = facet === 'owner'
  const timelineFirst = facet === 'history' || facet === 'deadline'
  const topic = card.contextTopicId ? state.contexts.find((t) => t.id === card.contextTopicId) : undefined
  const window = spendWindow(state.now)
  const invoices = topic?.spend ? invoicesInWindow(topic.spend, window) : []
  const showChart = facet === 'cost' && topic?.spend && invoices.length > 0
  const decision = card.decisionId ? state.decisions.find((d) => d.id === card.decisionId) : undefined

  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">{FACET_LABEL[facet]}</Pill>
          <span>
            {CATEGORY_LABEL[card.category]} · {card.subtitle}
          </span>
        </div>
        <h1 className="text-4xl leading-none font-semibold tracking-tight text-balance">{card.title}</h1>
        {triggeredBy && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
          </p>
        )}
      </header>

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-1">
          {lead && (
            <div className="col-span-2 flex flex-col md:col-span-1">
              <dt className="text-xs text-muted-foreground">{lead.label}</dt>
              <dd className="text-5xl font-semibold tracking-tight tabular-nums">{lead.value}</dd>
              {lead.hint && <dd className="text-xs text-muted-foreground">{lead.hint}</dd>}
            </div>
          )}
          {rest.map((fact) => (
            <div key={fact.label} className="flex flex-col">
              <dt className="text-[11px] text-muted-foreground">{fact.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{fact.value}</dd>
              {fact.hint && <dd className="text-[11px] text-muted-foreground">{fact.hint}</dd>}
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
          <p className="text-xl leading-relaxed text-pretty">{answer}</p>
          {facet !== 'general' && <p className="text-sm leading-relaxed text-muted-foreground">{card.answers.general}</p>}
          {showChart && topic?.spend && <SpendChart spend={topic.spend} invoices={invoices} />}
        </div>
      </section>

      <div className={cn('grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]', peopleFirst && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
        <div className={cn('flex min-w-0 flex-col gap-5', peopleFirst && 'lg:order-2')}>
          <Panel title="Co się działo" className={cn(timelineFirst && 'ring-1 ring-ring/40')}>
            <ol className="flex flex-col gap-2">
              {card.timeline.map((event) => {
                const Icon = EVENT_ICON[event.kind]
                const strong = event.kind === 'approved' || event.kind === 'decision' || event.kind === 'deadline'
                return (
                  <li key={`${event.at}-${event.title}`} className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
                    <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', strong ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium leading-snug">{event.title}</p>
                        {event.amount && <p className={cn('shrink-0 text-sm tabular-nums', event.kind === 'rejected' ? 'text-muted-foreground line-through' : 'font-medium')}>{event.amount}</p>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDayMonth(event.at)}
                        {event.personId ? ` · ${state.people.find((p) => p.id === event.personId)?.name ?? ''}` : ''}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/85">{event.detail}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Panel>

          {card.openItems.length > 0 && (
            <Panel title="Otwarte" caption="Ustalenia bez terminu albo bez decyzji.">
              <ul className="flex flex-col gap-2 text-sm leading-relaxed">
                {card.openItems.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <aside className={cn('flex min-w-0 flex-col gap-5', peopleFirst && 'lg:order-1')}>
          <Panel title="Kto odpowiada" className={cn(peopleFirst && 'ring-1 ring-ring/40')}>
            <ul className="flex flex-col divide-y divide-border">
              {card.people.map((role) => {
                const person = state.people.find((p) => p.id === role.personId)
                return (
                  <li key={role.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                      {initials(person?.name ?? '?')}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{role.label}</span>
                      <span className="text-sm font-medium leading-snug">
                        {person?.name ?? '—'}
                        {person?.role && <span className="font-normal text-muted-foreground"> · {person.role}</span>}
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground">{role.note}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </Panel>

          {decision && (
            <Link
              to="/decisions/$decisionId"
              params={{ decisionId: decision.id }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm transition-colors hover:bg-muted"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Powiązana sprawa</span>
                <span className="truncate font-medium">{decision.title}</span>
              </span>
              <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          )}

          <Panel title="Źródła" caption="Skąd to wiemy.">
            <SourceList sourceIds={card.sourceIds} />
          </Panel>
        </aside>
      </div>
    </article>
  )
}
