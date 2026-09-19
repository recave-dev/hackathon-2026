import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowUpRightIcon, FilesIcon } from 'lucide-react'

import { EmptyHint, PageHeader } from '@/components/desktop/page'
import { formatDayMonth, formatMoney } from '@/demo/format'
import { CONTEXT_CATEGORY_LABEL, invoicesInWindow, personName, spendWindow, sumInvoices } from '@/demo/selectors'
import { useDemoState } from '@/demo/store'
import type { ContextTopic, DemoState } from '@/demo/types'

export const Route = createFileRoute('/_workspace/context/')({
  component: ContextIndex,
})

function ContextIndex() {
  const state = useDemoState()
  return (
    <>
      <PageHeader
        title="Context"
        description="Wiedza o firmie zebrana ze źródeł: co ile kosztuje, kto za to odpowiada i gdzie to zapisano. Każda liczba prowadzi do źródła."
      />
      {state.contexts.length === 0 ? (
        <EmptyHint>Brak tematów. Pojawią się tu, gdy agent zebierze źródła.</EmptyHint>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.contexts.map((topic) => (
            <TopicCard key={topic.id} topic={topic} state={state} />
          ))}
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Kolejne tematy dołączą po zaimportowaniu następnych kanałów i skrzynek.
          </div>
        </div>
      )}
    </>
  )
}

function TopicCard({ topic, state }: { topic: ContextTopic; state: DemoState }) {
  const window = spendWindow(state.now)
  const invoices = topic.spend ? invoicesInWindow(topic.spend, window) : []
  const owner = topic.roles.find((r) => r.label.startsWith('Odpowiada'))

  return (
    <Link
      to="/context/$topicId"
      params={{ topicId: topic.id }}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{CONTEXT_CATEGORY_LABEL[topic.category]}</p>
          <p className="text-lg font-semibold leading-snug">{topic.title}</p>
          <p className="text-xs text-muted-foreground">{topic.subtitle}</p>
        </div>
        <ArrowUpRightIcon className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      <p className="text-sm leading-relaxed text-foreground/85">„{topic.question}”</p>

      {topic.spend && (
        <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div className="flex flex-col">
            <dt className="text-[11px] text-muted-foreground">Ostatnie 6 miesięcy</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatMoney(sumInvoices(invoices), topic.spend.currency)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[11px] text-muted-foreground">Odpowiada</dt>
            <dd className="text-sm font-medium leading-snug">{owner ? personName(state, owner.personId) : '—'}</dd>
          </div>
        </dl>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FilesIcon className="size-3.5" /> {topic.sourceIds.length} źródeł
        </span>
        <span>aktualizacja {formatDayMonth(topic.updatedAt)}</span>
      </div>
    </Link>
  )
}
