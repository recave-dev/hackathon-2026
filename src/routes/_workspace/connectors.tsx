import { createFileRoute } from '@tanstack/react-router'
import { LibraryIcon } from 'lucide-react'

import { ConnectorCard, enabledCount } from '@/components/desktop/connector-card'
import { PageHeader } from '@/components/desktop/page'
import { plural } from '@/demo/format'
import { useDemoState } from '@/demo/store'

export const Route = createFileRoute('/_workspace/connectors')({
  staticData: { crumb: 'Connectors' },
  component: Connectors,
})

function Connectors() {
  const state = useDemoState()
  const live = state.connectors.filter((c) => c.status === 'connected' || c.status === 'paused')
  const imported = live.reduce((n, c) => n + enabledCount(c), 0)

  return (
    <>
      <PageHeader
        title="Connectors"
        description="Źródła, z których agent buduje wiedzę o firmie. Połącz Slack, skrzynkę i spotkania — każde ustalenie w Context i każda sprawa w Decisions prowadzi z powrotem do wiadomości, maila albo minuty nagrania."
        meta={
          <>
            <span>
              {live.length}/{state.connectors.length} {plural(state.connectors.length, 'połączony', 'połączone', 'połączonych')}
            </span>
            {imported > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <LibraryIcon className="size-3.5" /> {imported.toLocaleString('pl-PL')} {plural(imported, 'element', 'elementy', 'elementów')} w bazie wiedzy
              </span>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {state.connectors.map((connector) => (
          <ConnectorCard key={connector.id} connector={connector} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Kolejne w planie: Google Drive, Jira, Pipedrive, Fakturownia. Każdy konektor działa w trybie tylko-do-odczytu; agent pisze wyłącznie tam, gdzie
        pozwolisz mu zadać pytanie.
      </p>
    </>
  )
}
