import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'

import { DecisionCard } from '@/components/app/decision-card'
import { EmptyHint, Screen } from '@/components/app/screen'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { decisionsFor, type DecisionFilter } from '@/demo/selectors'
import { useDemoState } from '@/demo/store'

const FILTERS: DecisionFilter[] = ['pending', 'snoozed', 'history']
const FILTER_LABEL: Record<DecisionFilter, string> = {
  pending: 'Do decyzji',
  snoozed: 'Odłożone',
  history: 'Historia',
}

export const Route = createFileRoute('/app/decisions/')({
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
    <Screen
      title="Decisions"
      description={
        filter === 'pending'
          ? 'Sprawy, które czekają na Twoją reakcję.'
          : filter === 'snoozed'
            ? 'Odłożone — wrócą do kolejki w wybranym terminie.'
            : 'Podjęte i delegowane decyzje. Realizacja może nadal trwać.'
      }
    >
      <Tabs value={filter} onValueChange={(value) => void navigate({ search: { filter: value as DecisionFilter } })}>
        <TabsList aria-label="Filtr spraw" className="h-9 w-full">
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f} className="px-2">
              {FILTER_LABEL[f]}
              <span className="text-xs text-muted-foreground tabular-nums">{counts[f]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filter === 'pending' && decisions.length > 0 && (
        <p className="-mt-3 px-0.5 text-xs text-muted-foreground">
          Gesty na karcie: w lewo — odłóż, w górę — kontekst, w prawo — opcje. Gest niczego nie zatwierdza.
        </p>
      )}

      {decisions.length === 0 ? (
        <EmptyHint>
          {filter === 'pending' ? 'Kolejka jest pusta. Nowe sprawy pojawią się tu po zapisaniu notatki w Session.' : 'Nic tu jeszcze nie ma.'}
        </EmptyHint>
      ) : (
        <div className="flex flex-col gap-4 pb-4">
          {decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} />
          ))}
        </div>
      )}
    </Screen>
  )
}
