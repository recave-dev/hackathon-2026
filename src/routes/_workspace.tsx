import { Outlet, createFileRoute } from '@tanstack/react-router'

import { WorkspaceShell } from '@/components/desktop/workspace-shell'

export const Route = createFileRoute('/_workspace')({
  head: () => ({
    meta: [{ title: 'Droker · Workspace' }, { name: 'theme-color', content: '#faf8f4' }],
  }),
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  return (
    <WorkspaceShell>
      <Outlet />
    </WorkspaceShell>
  )
}
