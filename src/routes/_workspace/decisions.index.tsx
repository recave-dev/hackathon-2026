import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ClockIcon, FilesIcon, SparklesIcon } from 'lucide-react'
import { useMemo } from 'react'

import { EmptyHint, PageHeader, Pill } from '@/components/desktop/page'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, formatDue, isOverdue } from '@/demo/format'
import { STATUS_LABEL, decisionsFor, personName, projectLabel, type DecisionFilter } from '@/demo/selectors'
import { useDemoState } from '@/demo/store'
import { cn } from '@/lib/utils'

const FILTERS: DecisionFilter[] = ['pending', 'snoozed', 'history']
const FILTER_LABEL: Record<DecisionFilter, string> = {
  pending: 'Do decyzji',
  snoozed: 'Odłożone',
  history: 'Historia',
}

export const Route = createFileRoute('/_workspace/decisions/')({
  validateSearch: (search: Record<string, unknown>): { filter?: DecisionFilter } => {
    const filter = search.filter
    return FILTERS.includes(filter as DecisionFilter) ? { filter: filter as DecisionFilter } : {}
  },
  component: Decisions,
})

function Decisions() {
  const { filter = 'pending' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const state = useDemoState()
  const decisions = useMemo(() => decisionsFor(state, filter), [state, filter])
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f, decisionsFor(state, f).length])) as Record<DecisionFilter, number>,
    [state],
  )

  return (
    <>
      <PageHeader
        title="Decisions"
        description="Sprawy zebrane przez agenta z maili, Slacka i notatek. Decyzje zatwierdza się w widoku mobilnym; tutaj jest pełny kontekst i historia."
        action={
          <Button nativeButton={false} render={<Link to="/decisions/new" />}>
            <SparklesIcon /> Nowa sprawa
          </Button>
        }
      />
      <Tabs value={filter} onValueChange={(value) => void navigate({ search: { filter: value as DecisionFilter } })}>
        <TabsList aria-label="Filtr spraw" className="h-9">
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f} className="px-3">
              {FILTER_LABEL[f]}
              <span className="text-xs text-muted-foreground tabular-nums">{counts[f]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {decisions.length === 0 ? (
        <EmptyHint>{filter === 'pending' ? 'Kolejka jest pusta.' : 'Nic tu jeszcze nie ma.'}</EmptyHint>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {decisions.map((decision) => {
            const overdue = decision.status === 'pending' && isOverdue(decision.dueAt, state.now)
            return (
              <li key={decision.id}>
                <Link
                  to="/decisions/$decisionId"
                  params={{ decisionId: decision.id }}
                  className="grid gap-x-6 gap-y-2 p-5 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 md:grid-cols-[minmax(0,1fr)_14rem]"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{projectLabel(state, decision.projectId)}</p>
                    <p className="text-base font-semibold leading-snug">{decision.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{decision.why}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs text-muted-foreground md:items-end md:text-right">
                    <Pill tone={decision.status === 'pending' ? 'accent' : 'muted'}>{STATUS_LABEL[decision.status]}</Pill>
                    {decision.status === 'pending' && (
                      <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}>
                        <ClockIcon className="size-3.5" /> reakcja do {formatDue(decision.dueAt, state.now)}
                      </span>
                    )}
                    {decision.status === 'snoozed' && decision.snoozedUntil && (
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="size-3.5" /> wraca {formatDue(decision.snoozedUntil, state.now)}
                      </span>
                    )}
                    {decision.status === 'delegated' && <span>odpowiada {personName(state, decision.delegatedToId)}</span>}
                    {(decision.status === 'decided' || decision.status === 'completed') && decision.decidedAt && (
                      <span>{formatDateTime(decision.decidedAt)}</span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <FilesIcon className="size-3.5" /> {decision.sourceIds.length} źródeł
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
