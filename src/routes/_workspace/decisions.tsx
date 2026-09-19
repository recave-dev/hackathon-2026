import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_workspace/decisions')({
  staticData: { crumb: 'Decisions' },
  component: Outlet,
})
