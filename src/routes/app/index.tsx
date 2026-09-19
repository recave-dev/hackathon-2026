import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ORB_STATES, type OrbState } from '@/registry/lib/orb-state'
import { OrbStatus } from '@/registry/lib/orb-status'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'

export const Route = createFileRoute('/app/')({ component: AppHome })

const DEMO_STATES: readonly OrbState[] = [...ORB_STATES, 'error', 'disabled']

function AppHome() {
  const [state, setState] = useState<OrbState>('speaking')

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <NebulaOrb
        state={state}
        size={184}
        speed={1}
        colorFrom="#8b5cf6"
        colorTo="#22d3ee"
      />
      <OrbStatus
        state={state}
        className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
      />

      <ToggleGroup
        aria-label="Stan orba (demo)"
        value={[state]}
        onValueChange={(value) => {
          const next = value[0]
          if (typeof next === 'string') setState(next as OrbState)
        }}
        variant="outline"
        size="sm"
        className="max-w-full flex-wrap justify-center"
      >
        {DEMO_STATES.map((s) => (
          <ToggleGroupItem key={s} value={s} className="capitalize">
            {s}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  )
}
