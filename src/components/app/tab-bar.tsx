import { Link, useMatchRoute } from '@tanstack/react-router'
import { HistoryIcon, ScaleIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import { cn } from '@/lib/utils'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'

type SideTab = {
  to: '/app/recent' | '/app/decisions'
  label: string
  icon: ComponentType<{ className?: string }>
}

const LEFT: SideTab = { to: '/app/recent', label: 'Recent', icon: HistoryIcon }
const RIGHT: SideTab = { to: '/app/decisions', label: 'Decisions', icon: ScaleIcon }

function SideTabLink({ to, label, icon: Icon }: SideTab) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="flex flex-1 items-center justify-center rounded-xl text-muted-foreground transition-colors outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/50"
      activeProps={{ className: 'text-foreground' }}
    >
      <Icon className="size-6" />
    </Link>
  )
}

export function TabBar({ className }: { className?: string }) {
  const matchRoute = useMatchRoute()
  const inSession = Boolean(matchRoute({ to: '/app/session' }))

  return (
    <nav
      aria-label="Główna nawigacja"
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 flex justify-center',
        className,
      )}
    >
      <div className="relative w-full max-w-md border-t border-white/10 bg-background/80 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="flex h-14 items-stretch px-2">
          <SideTabLink {...LEFT} />
          {/* Spacer keeps the side tabs symmetric around the raised orb. */}
          <div aria-hidden className="w-24 shrink-0" />
          <SideTabLink {...RIGHT} />
        </div>

        <Link
          to="/app/session"
          aria-label="Blob – tryb rozmowy"
          className="group absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 outline-none"
        >
          {/* TanStack Link sets data-status="active" on the anchor when matched. */}
          <span className="relative flex size-[76px] items-center justify-center rounded-full border border-white/10 bg-background shadow-[0_12px_32px_-8px_rgba(139,92,246,0.55)] transition-transform group-hover:scale-[1.04] group-focus-visible:ring-2 group-focus-visible:ring-ring/60 group-data-[status=active]:border-white/25 group-data-[status=active]:shadow-[0_0_0_4px_rgba(139,92,246,0.22),0_12px_32px_-8px_rgba(34,211,238,0.6)]">
            {/* Drawn larger than the disc and left unclipped so the blob fills the
                disc while its glow spills past the edge and reads as floating. */}
            <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <NebulaOrb state={inSession ? 'listening' : 'idle'} size={112} label="" />
            </span>
          </span>
        </Link>
      </div>
    </nav>
  )
}
