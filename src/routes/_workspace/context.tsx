import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_workspace/context')({
  staticData: { crumb: 'Context' },
  component: Outlet,
})
