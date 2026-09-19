import { Outlet, createFileRoute } from '@tanstack/react-router'

import { TabBar } from '@/components/app/tab-bar'
import { Toaster } from '@/components/ui/toast'
import { useHydrated } from '@/demo/store'

export const Route = createFileRoute('/app')({
  head: () => ({
    meta: [
      { title: 'Droker · Asystent zarządu' },
      { name: 'theme-color', content: '#faf8f4' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
    ],
  }),
  component: AppLayout,
})

function AppLayout() {
  const hydrated = useHydrated()
  return (
    <div className="app-theme min-h-svh bg-background text-foreground antialiased">
      <Toaster>
        {/* Bottom padding reserves room for the fixed tab bar and its raised orb. */}
        <main
          className="relative mx-auto flex min-h-svh w-full max-w-md flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
          style={{ visibility: hydrated ? 'visible' : 'hidden' }}
        >
          <Outlet />
        </main>
        <TabBar />
      </Toaster>
    </div>
  )
}
