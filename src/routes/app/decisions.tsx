import { createFileRoute } from '@tanstack/react-router'

import { EmptyHint, Screen } from '@/components/app/screen'

export const Route = createFileRoute('/app/decisions')({ component: Decisions })

function Decisions() {
  return (
    <Screen title="Decisions" description="Decisions captured from your sessions.">
      <EmptyHint>Nothing decided yet.</EmptyHint>
    </Screen>
  )
}
