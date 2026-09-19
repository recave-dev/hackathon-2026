import { Link, createFileRoute } from '@tanstack/react-router'
import { CheckIcon, CircleAlertIcon, FilesIcon, XIcon } from 'lucide-react'

import { SourceList } from '@/components/app/sources'
import { BulletList, Figure, PageHeader, Panel, Pill, initials } from '@/components/desktop/page'
import { SpendChart } from '@/components/desktop/spend-chart'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatDayMonth, formatMoney } from '@/demo/format'
import { CONTEXT_CATEGORY_LABEL, STATUS_LABEL, invoicesInWindow, personName, spendWindow, sumInvoices } from '@/demo/selectors'
import { useDemoState, useHydrated } from '@/demo/store'
import type { ContextEvent, ContextTopic, DemoState } from '@/demo/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_workspace/context/$topicId')({
  staticData: {
    crumb: (params, state) => state.contexts.find((t) => t.id === params.topicId)?.title ?? 'Temat',
  },
  component: ContextDetail,
})

function ContextDetail() {
  const { topicId } = Route.useParams()
  const state = useDemoState()
  const hydrated = useHydrated()
  const topic = state.contexts.find((t) => t.id === topicId)
  if (!topic) {
    return hydrated ? <PageHeader title="Nie znaleziono tematu" description="Sprawdź adres albo wróć do listy tematów." /> : null
  }
  return <TopicView topic={topic} state={state} />
}

function TopicView({ topic, state }: { topic: ContextTopic; state: DemoState }) {
  const window = spendWindow(state.now)
  const invoices = topic.spend ? invoicesInWindow(topic.spend, window) : []
  const total = sumInvoices(invoices)
  const approver = topic.roles.find((r) => r.label.startsWith('Zatwierdza'))
  const owner = topic.roles.find((r) => r.label.startsWith('Odpowiada'))
  const related = topic.relatedDecisionIds
    .map((id) => state.decisions.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))

  return (
    <>
      <PageHeader
        eyebrow={`${CONTEXT_CATEGORY_LABEL[topic.category]} · ${topic.subtitle}`}
        title={topic.title}
        description={`„${topic.question}”`}
        meta={
          <>
            <span className="inline-flex items-center gap-1">
              <FilesIcon className="size-3.5" /> {topic.sourceIds.length} źródeł
            </span>
            <span>aktualizacja {formatDateTime(topic.updatedAt)}</span>
            <Pill>Dane demo</Pill>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {topic.spend && (
            <Panel title="Odpowiedź" caption={`Okno: ${formatDayMonth(window.from)} – ${formatDayMonth(window.to)}, liczone od zegara demo.`}>
              <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-1">
                  <Figure label="Ostatnie 6 miesięcy" value={formatMoney(total, topic.spend.currency)} hint={`${invoices.length} faktur`} size="lg" />
                  <Figure label="Miesięcznie" value={formatMoney(topic.spend.monthly, topic.spend.currency)} hint={`${topic.spend.seats} miejsc`} />
                  <Figure label="Limit CFO" value={formatMoney(topic.spend.cap, topic.spend.currency)} hint="na miesiąc" />
                  <Figure label="Zapas" value={formatMoney(topic.spend.cap - topic.spend.monthly, topic.spend.currency)} hint="pod limitem" />
                </dl>
                <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6">
                  <p className="text-base leading-relaxed">
                    Od {formatDayMonth(window.from)} do {formatDayMonth(window.to)}:{' '}
                    <span className="font-semibold tabular-nums">{formatMoney(total, topic.spend.currency)}</span> w {invoices.length} fakturach.
                    {approver && (
                      <>
                        {' '}
                        Zatwierdza <span className="font-medium">{personName(state, approver.personId)}</span>
                        {roleSuffix(state, approver.personId)}
                      </>
                    )}
                    {owner && (
                      <>
                        , za subskrypcję odpowiada <span className="font-medium">{personName(state, owner.personId)}</span>
                        {roleSuffix(state, owner.personId)}.
                      </>
                    )}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{topic.answer}</p>
                </div>
              </div>
            </Panel>
          )}

          {topic.spend && invoices.length > 0 && (
            <Panel title="Faktury miesięczne" caption="Kwoty pochodzą wyłącznie z maili z fakturami. Nie ma jeszcze eksportu z księgowości.">
              <SpendChart spend={topic.spend} invoices={invoices} />
            </Panel>
          )}

          {topic.events.length > 0 && (
            <Panel
              title="Wnioski zakupowe"
              caption="Zatwierdzone i odrzucone wnioski dotyczące tego narzędzia. Odrzucone nie wygenerowały faktur. Wnioski o inne produkty z tego samego kanału są oznaczone jako powiązane."
            >
              <ol className="flex flex-col gap-2">
                {topic.events.map((event) => (
                  <EventRow key={event.id} event={event} state={state} currency={topic.spend?.currency ?? 'EUR'} />
                ))}
              </ol>
            </Panel>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Panel title="Kto odpowiada">
            <ul className="flex flex-col divide-y divide-border">
              {topic.roles.map((role) => {
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

          <Panel title="Do sprawdzenia" caption="Ustalenia zapisane w źródłach, które nie mają jeszcze terminu.">
            <BulletList items={topic.openItems} />
          </Panel>

          {related.length > 0 && (
            <Panel title="Powiązane sprawy">
              <div className="flex flex-col gap-2">
                {related.map((d) => (
                  <Button
                    key={d.id}
                    variant="outline"
                    nativeButton={false}
                    className="h-auto w-full justify-between gap-3 py-2.5 text-left"
                    render={<Link to="/decisions/$decisionId" params={{ decisionId: d.id }} />}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{d.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {STATUS_LABEL[d.status]}
                        {d.decidedAt ? ` · ${formatDayMonth(d.decidedAt)}` : ''}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Źródła" caption="Wątki z kanału zakupowego i maile z fakturami.">
            <SourceList sourceIds={topic.sourceIds} />
          </Panel>
        </aside>
      </div>
    </>
  )
}

function roleSuffix(state: DemoState, personId: string): string {
  const role = state.people.find((p) => p.id === personId)?.role
  return role ? ` (${role})` : ''
}

function EventRow({ event, state, currency }: { event: ContextEvent; state: DemoState; currency: string }) {
  const approved = event.kind === 'approved'
  const Icon = approved ? CheckIcon : event.kind === 'rejected' ? XIcon : CircleAlertIcon
  return (
    <li className={cn('flex items-start gap-3 rounded-xl border bg-background/40 p-3.5', event.related ? 'border-dashed border-border' : 'border-border')}>
      <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', approved ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {event.related && <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Powiązany wniosek · inny produkt</p>}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-snug">{event.title}</p>
          {event.amount !== undefined && (
            <p className={cn('shrink-0 text-sm tabular-nums', approved ? 'font-medium' : 'text-muted-foreground line-through')}>
              {formatMoney(event.amount, currency)}
              <span className="text-[11px]"> / mies.</span>
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className={cn('font-medium', approved ? 'text-primary' : 'text-foreground/70')}>
            {approved ? 'Zatwierdzono' : event.kind === 'rejected' ? 'Odrzucono' : 'Notatka'}
          </span>
          {' · '}
          {formatDateTime(event.at)}
          {event.personId ? ` · ${personName(state, event.personId)}` : ''}
        </p>
        <p className="text-sm leading-relaxed text-foreground/85">{event.detail}</p>
      </div>
    </li>
  )
}
