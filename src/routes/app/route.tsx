import { Outlet, createFileRoute } from '@tanstack/react-router'

import { TabBar } from '@/components/app/tab-bar'

export const Route = createFileRoute('/app')({
  head: () => ({
    meta: [
      { title: 'Hackathon 2026 · App' },
      { name: 'theme-color', content: '#0a0a0b' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
    ],
  }),
  component: AppLayout,
})

function AppLayout() {
  return (
    <div
      className="dark min-h-svh bg-background text-foreground"
      style={{ colorScheme: 'dark' }}
    >
      {/* Bottom padding reserves room for the fixed tab bar and its raised orb. */}
      <main className="relative mx-auto flex min-h-svh w-full max-w-md flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
