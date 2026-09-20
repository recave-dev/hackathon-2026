import { ArrowUpRightIcon, BriefcaseIcon, CalendarClockIcon, CheckIcon, CircleAlertIcon, CircleDotIcon, ClockIcon, GavelIcon, InboxIcon, XIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Panel, Pill, initials } from '@/components/desktop/page'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDayMonth } from '@/demo/format'
import { FACET_LABEL, type Facet } from '@/demo/knowledge'
import { cn } from '@/lib/utils'
import type { CardEvent, GraphCitation, GraphPersonCard, TopicCard } from '@/server/meeting-assist'

/**
 * Cards built from the company graph, no language model in the loop. The
 * topic card answers from the angle the room asked about (cost, owner,
 * deadline, status, history, options); the person card shows what someone
 * decides, approves or owns. Both end with the quoted sources behind them.
 */

const EVENT_ICON: Record<CardEvent['kind'], ComponentType<{ className?: string }>> = {
  approved: CheckIcon,
  rejected: XIcon,
  decision: GavelIcon,
  open: CircleDotIcon,
  deadline: CalendarClockIcon,
  request: InboxIcon,
  note: CircleAlertIcon,
}

function Trigger({ triggeredBy }: { triggeredBy?: { speaker: string; text: string } }) {
  if (!triggeredBy) return null
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
    </p>
  )
}

const shortPath = (path: string): string => path.replace(/^knowledge\/synthetic\//, '')

function Citations({ items, caption }: { items: GraphCitation[]; caption: string }) {
  if (!items.length) return null
  return (
    <Panel title="Skąd to wiemy" caption={caption}>
      <ol className="flex flex-col gap-2">
        {items.map((c) => (
          <li key={`${c.id}-${c.path}`} className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-[11px] text-muted-foreground">{c.id}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-xs text-muted-foreground">
                <span className="truncate">{shortPath(c.path)}</span>
                {c.date && <span> · {formatDayMonth(c.date)}</span>}
              </p>
              <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed whitespace-pre-line text-foreground/85">{c.quote}</blockquote>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function Timeline({ events, highlight }: { events: CardEvent[]; highlight: boolean }) {
  return (
    <Panel title="Co się działo" caption="Decyzje, wnioski, faktury i terminy z grafu firmy." className={cn(highlight && 'ring-1 ring-ring/40')}>
      {events.length === 0 && <p className="text-sm text-muted-foreground">Brak zdarzeń.</p>}
      <ol className="flex flex-col gap-2">
        {events.map((event, i) => {
          const Icon = EVENT_ICON[event.kind]
          const strong = event.kind === 'approved' || event.kind === 'decision' || event.kind === 'deadline' || event.kind === 'open'
          return (
            <li key={`${event.at}-${event.title}-${i}`} className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
              <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', strong ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-snug">{event.title}</p>
                  {event.amount && <p className={cn('shrink-0 text-sm tabular-nums', event.kind === 'rejected' ? 'text-muted-foreground line-through' : 'font-medium')}>{event.amount}</p>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {event.at ? formatDayMonth(event.at) : 'bez daty'}
                  {event.who ? ` · ${event.who}` : ''}
                </p>
                {event.detail && <p className="text-sm leading-relaxed text-foreground/85">{event.detail}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function SpendBars({ spend }: { spend: NonNullable<TopicCard['spend']> }) {
  const data = spend.byMonth.map((m) => ({ month: m.month.slice(5), value: m.value }))
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${String(v ?? '')} ${spend.currency}`, spend.metric]} />
          <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** One topic from the graph, answered from the angle the room asked about. */
export function TopicCardView({ card, triggeredBy, onOpenPerson, className }: { card: TopicCard; triggeredBy?: { speaker: string; text: string }; onOpenPerson?: (personId: string) => void; className?: string }) {
  const facet: Facet = card.facet
  const facts = [...card.facts].sort((a, b) => Number(b.facets.includes(facet)) - Number(a.facets.includes(facet)))
  const lead = facts[0]
  const rest = facts.slice(1)
  const peopleFirst = facet === 'owner'
  const timelineFirst = facet === 'history' || facet === 'deadline'
  const showChart = facet === 'cost' && card.spend && card.spend.byMonth.length > 1

  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">{FACET_LABEL[facet]}</Pill>
          <span>{card.subtitle}</span>
          <span className="text-muted-foreground/70">· z grafu firmy, {card.latencyMs} ms</span>
        </div>
        <h1 className="text-4xl leading-none font-semibold tracking-tight text-balance">{card.title}</h1>
        <Trigger triggeredBy={triggeredBy} />
      </header>

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-1">
          {card.headline ? (
            <div className="col-span-2 flex max-w-sm flex-col md:col-span-1">
              <dt className="text-xs text-muted-foreground">{lead && lead.facets.includes(facet) ? lead.label : FACET_LABEL[facet]}</dt>
              <dd className="text-5xl font-semibold tracking-tight text-balance tabular-nums">{card.headline}</dd>
              {lead && lead.facets.includes(facet) && lead.hint && <dd className="text-xs text-muted-foreground">{lead.hint}</dd>}
            </div>
          ) : (
            lead && (
              <div className="col-span-2 flex flex-col md:col-span-1">
                <dt className="text-xs text-muted-foreground">{lead.label}</dt>
                <dd className="text-5xl font-semibold tracking-tight tabular-nums">{lead.value}</dd>
                {lead.hint && <dd className="text-xs text-muted-foreground">{lead.hint}</dd>}
              </div>
            )
          )}
          {(card.headline && lead && lead.facets.includes(facet) ? rest : card.headline ? facts : rest).map((fact) => (
            <div key={fact.label} className="flex flex-col">
              <dt className="text-[11px] text-muted-foreground">{fact.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{fact.value}</dd>
              {fact.hint && <dd className="text-[11px] text-muted-foreground">{fact.hint}</dd>}
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
          <p className="text-xl leading-relaxed text-pretty">{card.answer}</p>
          {!card.found && <p className="text-sm text-muted-foreground">Graf firmy ma tylko samą nazwę tego tematu; brak powiązanych decyzji i źródeł.</p>}
          {showChart && card.spend && <SpendBars spend={card.spend} />}
        </div>
      </section>

      <div className={cn('grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]', peopleFirst && 'lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
        <div className={cn('flex min-w-0 flex-col gap-5', peopleFirst && 'lg:order-2')}>
          <Timeline events={card.timeline} highlight={timelineFirst} />

          {card.options.length > 0 && (
            <Panel title="Opcje" caption="Rozważane warianty i to, co wybrano." className={cn(facet === 'options' && 'ring-1 ring-ring/40')}>
              <ul className="flex flex-col gap-2 text-sm leading-relaxed">
                {card.options.map((o) => (
                  <li key={`${o.decision}-${o.id}`} className={cn('flex items-start gap-2.5 rounded-xl border border-border p-3', o.selected && 'bg-accent/40 ring-1 ring-ring/30')}>
                    <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md', o.selected ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>{o.selected ? <CheckIcon className="size-3" /> : <CircleDotIcon className="size-3" />}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {o.label}
                        {o.selected && <span className="ml-2 text-xs font-normal text-muted-foreground">wybrana</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{o.decision}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {card.open.length > 0 && (
            <Panel title="Otwarte" caption="Zadania i decyzje bez zamknięcia.">
              <ul className="flex flex-col gap-2 text-sm leading-relaxed">
                {card.open.map((item) => (
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
            {card.people.length === 0 && <p className="text-sm text-muted-foreground">Brak przypisanych osób.</p>}
            <ul className="flex flex-col divide-y divide-border">
              {card.people.map((p) => (
                <li key={`${p.label}-${p.id}`}>
                  <button type="button" onClick={() => onOpenPerson?.(p.id)} className="flex w-full items-start gap-3 py-3 text-left first:pt-0 last:pb-0 hover:opacity-80" disabled={!onOpenPerson}>
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                      {initials(p.name)}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{p.label}</span>
                      <span className="text-sm font-medium leading-snug">
                        {p.name}
                        {p.role && <span className="font-normal text-muted-foreground"> · {p.role}</span>}
                      </span>
                    </span>
                    {onOpenPerson && <ArrowUpRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Citations items={card.citations} caption="Cytaty ze źródeł powiązanych z tym tematem." />
        </aside>
      </div>
    </article>
  )
}

/** "Who is X": one person from the graph, what they decide, approve and own. */
export function GraphPersonView({ card, triggeredBy, onOpenTopic, className }: { card: GraphPersonCard; triggeredBy?: { speaker: string; text: string }; onOpenTopic?: (topicId: string) => void; className?: string }) {
  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite">
      <header className="flex items-start gap-5">
        <span aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-3xl bg-accent text-2xl font-semibold text-accent-foreground">
          {initials(card.name)}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Pill tone="accent">Osoba</Pill>
            <span>z grafu firmy, {card.latencyMs} ms</span>
          </div>
          <h1 className="text-4xl leading-none font-semibold tracking-tight text-balance">{card.name}</h1>
          {card.role && <p className="text-lg text-muted-foreground">{card.role}</p>}
          <Trigger triggeredBy={triggeredBy} />
        </div>
      </header>

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-1">
          {card.facts.map((fact) => (
            <div key={fact.label} className="flex flex-col">
              <dt className="text-[11px] text-muted-foreground">{fact.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{fact.value}</dd>
              {fact.hint && <dd className="text-[11px] text-muted-foreground">{fact.hint}</dd>}
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Za co odpowiada</p>
            {card.owns.length === 0 && <p className="text-sm text-muted-foreground">Graf nie przypisuje tej osobie decyzji ani zadań.</p>}
            <ul className="grid gap-1.5 text-sm leading-relaxed">
              {card.owns.map((item) => (
                <li key={item} className="flex gap-2">
                  <BriefcaseIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {card.topics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Tematy</span>
              {card.topics.map((t) => (
                <button key={t.id} type="button" onClick={() => onOpenTopic?.(t.id)} disabled={!onOpenTopic} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium transition-colors hover:bg-muted">
                  {t.label} <ArrowUpRightIcon className="size-3 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Ostatnio" caption="Decyzje i zadania tej osoby, najnowsze pierwsze.">
          {card.recent.length === 0 && <p className="text-sm text-muted-foreground">Brak.</p>}
          <ol className="flex flex-col divide-y divide-border">
            {card.recent.map((item, i) => (
              <li key={`${item.at}-${item.title}-${i}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <ClockIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium leading-snug">
                    {item.title}
                    {item.at && <span className="font-normal text-muted-foreground"> · {formatDayMonth(item.at)}</span>}
                  </p>
                  {item.detail && <p className="text-sm leading-relaxed text-foreground/85">{item.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Citations items={card.citations} caption="Fragmenty źródeł, w których ta osoba się pojawia." />
      </div>
    </article>
  )
}

/** While the card is on its way from the graph (tens of milliseconds, but the layout should not jump). */
export function CardLoadingView({ title }: { title: string }) {
  return (
    <article className="flex min-w-0 flex-col gap-5" aria-busy>
      <header className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <h1 className="text-4xl leading-none font-semibold tracking-tight">{title}</h1>
      </header>
      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex min-w-[10rem] flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-40" />
        </div>
        <div className="flex flex-col gap-2 md:border-l md:border-border md:pl-6">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </section>
    </article>
  )
}
