import { Link, useMatchRoute, useMatches } from '@tanstack/react-router'
import { LibraryIcon, ListChecksIcon, SmartphoneIcon } from 'lucide-react'
import { Fragment, type ComponentType, type ReactNode } from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/toast'
import { formatLongDate, formatTime } from '@/demo/format'
import { useDemoState, useHydrated } from '@/demo/store'
import type { DemoState } from '@/demo/types'

/** Breadcrumb label a workspace route contributes; dynamic routes resolve it from params and state. */
export type Crumb = string | ((params: Record<string, string>, state: DemoState) => string)

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    crumb?: Crumb
  }
}

type NavItem = {
  to: '/decisions' | '/context'
  label: string
  icon: ComponentType<{ className?: string }>
  count?: number
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const state = useDemoState()
  const hydrated = useHydrated()
  const matchRoute = useMatchRoute()
  const pending = state.decisions.filter((d) => d.status === 'pending').length

  const items: NavItem[] = [
    { to: '/decisions', label: 'Decisions', icon: ListChecksIcon, count: pending },
    { to: '/context', label: 'Context', icon: LibraryIcon, count: state.contexts.length },
  ]

  return (
    <div className="app-theme min-h-svh bg-background text-foreground antialiased">
      <Toaster>
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader className="px-4 pt-5 pb-2">
              <Link to="/context" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  D
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight">Droker</span>
                  <span className="text-[11px] text-muted-foreground">Asystent zarządu</span>
                </span>
              </Link>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.map((item) => {
                      const active = Boolean(matchRoute({ to: item.to, fuzzy: true }))
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton isActive={active} render={<Link to={item.to} />}>
                            <item.icon className="size-4" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                          {item.count ? <SidebarMenuBadge className="tabular-nums">{item.count}</SidebarMenuBadge> : null}
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="gap-3 border-t border-sidebar-border px-4 py-4">
              <div className="flex flex-col gap-0.5 text-xs">
                <span className="font-medium">Droker · dane demo</span>
                <span className="text-muted-foreground">
                  Zegar demo: {formatLongDate(state.now)}, {formatTime(state.now)}
                </span>
              </div>
              <Link
                to="/app"
                className="inline-flex w-fit items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <SmartphoneIcon className="size-3.5" /> Widok mobilny
              </Link>
            </SidebarFooter>
          </Sidebar>

          <SidebarInset className="min-w-0">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl md:px-8">
              <SidebarTrigger className="-ml-1 md:hidden" />
              <WorkspaceBreadcrumbs state={state} />
            </header>
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:px-8" style={{ visibility: hydrated ? 'visible' : 'hidden' }}>
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </Toaster>
    </div>
  )
}

function WorkspaceBreadcrumbs({ state }: { state: DemoState }) {
  const matches = useMatches()
  const crumbs = matches
    .map((match) => {
      const crumb = match.staticData?.crumb
      if (!crumb) return null
      const label = typeof crumb === 'function' ? crumb(match.params as Record<string, string>, state) : crumb
      return { id: match.id, label, href: match.pathname }
    })
    .filter((c): c is { id: string; label: string; href: string } => Boolean(c))

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <span className="text-muted-foreground">Workspace</span>
        </BreadcrumbItem>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <Fragment key={crumb.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {last ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link to={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
