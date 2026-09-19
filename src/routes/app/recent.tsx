import { createFileRoute } from '@tanstack/react-router'

import { EmptyHint, Screen } from '@/components/app/screen'

export const Route = createFileRoute('/app/recent')({ component: Recent })

function Recent() {
  return (
    <Screen title="Recent" description="Your latest sessions and follow-ups.">
      <EmptyHint>No sessions yet. Tap the blob to start one.</EmptyHint>
    </Screen>
  )
}
