import { Link, useMatchRoute } from '@tanstack/react-router'
import { HouseIcon, ListChecksIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import { useDemoState } from '@/demo/store'
import { cn } from '@/lib/utils'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'

export const ORB_COLORS = { from: '#9db0ea', to: '#bfe6e6' } as const

type SideTab = {
  to: '/app/home' | '/app/decisions'
  label: string
  icon: ComponentType<{ className?: string }>
}

const LEFT: SideTab = { to: '/app/home', label: 'Home', icon: HouseIcon }
const RIGHT: SideTab = { to: '/app/decisions', label: 'Decisions', icon: ListChecksIcon }

function SideTabLink({ to, label, icon: Icon, count }: SideTab & { count?: number }) {
  return (
    <Link
      to={to}
      aria-label={count ? `${label} (${count} do decyzji)` : label}
      className="group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-muted-foreground transition-colors outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/50"
      activeProps={{ className: 'text-primary' }}
      activeOptions={{ includeSearch: false }}
    >
      <span className="relative">
        <Icon className="size-6" />
        {count ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
          >
            {count}
          </span>
        ) : null}
      </span>
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  )
}

export function TabBar({ className }: { className?: string }) {
  const matchRoute = useMatchRoute()
  const inSession = Boolean(matchRoute({ to: '/app/session' }))
  const pending = useDemoState().decisions.filter((d) => d.status === 'pending').length

  return (
    <nav
      aria-label="Główna nawigacja"
      className={cn('fixed inset-x-0 bottom-0 z-40 flex justify-center', className)}
    >
      <div className="relative w-full max-w-md border-t border-border bg-background/85 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="flex h-16 items-stretch px-2">
          <SideTabLink {...LEFT} />
          {/* Spacer keeps the side tabs symmetric around the raised orb. */}
          <div aria-hidden className="w-24 shrink-0" />
          <SideTabLink {...RIGHT} count={pending} />
        </div>

        <Link
          to="/app/session"
          aria-label="Session — przekaż kontekst głosem"
          className="group absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-[46%] flex-col items-center outline-none"
        >
          {/* TanStack Link sets data-status="active" on the anchor when matched. */}
          <span className="relative flex size-[72px] items-center justify-center rounded-full border border-border bg-card shadow-[0_10px_28px_-10px_rgba(75,106,168,0.45)] transition-transform motion-safe:group-hover:scale-[1.04] group-focus-visible:ring-2 group-focus-visible:ring-ring/60 group-data-[status=active]:border-primary/40 group-data-[status=active]:shadow-[0_0_0_4px_oklch(0.47_0.085_235_/_0.14),0_10px_28px_-10px_rgba(75,106,168,0.5)]">
            <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&_*]:pointer-events-none">
              <NebulaOrb
                state={inSession ? 'listening' : 'idle'}
                size={92}
                colorFrom={ORB_COLORS.from}
                colorTo={ORB_COLORS.to}
                label=""
              />
            </span>
          </span>
          <span className="mt-1 text-[11px] font-medium text-muted-foreground group-data-[status=active]:text-primary">
            Session
          </span>
        </Link>
      </div>
    </nav>
  )
}
