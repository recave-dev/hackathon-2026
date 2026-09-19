import { Outlet, createFileRoute } from '@tanstack/react-router'

import { Toaster } from '@/components/ui/toast'
import { useHydrated } from '@/demo/store'

export const Route = createFileRoute('/app')({
  head: () => ({
    meta: [
      { title: 'Droker · Asystent zarządu' },
      { name: 'theme-color', content: '#121215' },
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
    <div className="app-theme dark min-h-svh bg-background text-foreground antialiased">
      <Toaster>
        <main
          className="relative mx-auto flex min-h-svh w-full max-w-md flex-col"
          style={{ visibility: hydrated ? 'visible' : 'hidden' }}
        >
          <Outlet />
        </main>
      </Toaster>
    </div>
  )
}
