import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { useMemo } from 'react'

import { EmptyHint, initials } from '@/components/desktop/page'
import { firstName, formatDue, greetingFor, parseLocal } from '@/demo/format'
import { personName, projectLabel } from '@/demo/selectors'
import { useDemoState } from '@/demo/store'
import type { DemoState, Meeting } from '@/demo/types'
import { cn } from '@/lib/utils'
import { ASSISTANT_NAME } from '@/lib/wake-word'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'
import { ORB_COLORS } from '@/routes/app/index'

export const Route = createFileRoute('/_workspace/')({
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME} · Dashboard` }] }),
  staticData: { crumb: 'Dashboard' },
  component: Dashboard,
})

const byStart = (a: Meeting, b: Meeting): number => parseLocal(a.at).getTime() - parseLocal(b.at).getTime()

/** Meetings that have not started yet, soonest first. */
const upcomingMeetings = (state: DemoState): Meeting[] =>
  state.meetings.filter((m) => parseLocal(m.at).getTime() >= parseLocal(state.now).getTime()).sort(byStart)

function Dashboard() {
  const state = useDemoState()
  const meetings = useMemo(() => upcomingMeetings(state), [state])
  const me = personName(state, state.userId)

  return (
    <div className="flex flex-col gap-14 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {greetingFor(state.now)}, {firstName(me)}
      </h1>

      {/* Quick session: the orb alone, one click opens a fresh live session. */}
      <Link
        to="/meeting"
        className="group flex flex-col items-center gap-6 self-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-8 focus-visible:ring-offset-background"
      >
        <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase transition-colors group-hover:text-foreground">Szybka sesja</span>
        <NebulaOrb state="idle" size={200} colorFrom={ORB_COLORS.from} colorTo={ORB_COLORS.to} label="" className="pointer-events-none transition-transform duration-500 group-hover:scale-105" />
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Nadchodzące spotkania</h2>
        {meetings.length === 0 ? (
          <EmptyHint>Brak zaplanowanych spotkań.</EmptyHint>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {meetings.map((meeting) => (
              <li key={meeting.id}>
                <MeetingRow meeting={meeting} state={state} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function MeetingRow({ meeting, state }: { meeting: Meeting; state: DemoState }) {
  const startsSoon = parseLocal(meeting.at).getTime() - parseLocal(state.now).getTime() < 3 * 60 * 60 * 1000
  return (
    <Link
      to="/meeting"
      className="group flex items-center gap-5 px-5 py-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className={cn('w-24 shrink-0 text-sm tabular-nums', startsSoon ? 'font-medium text-primary' : 'text-muted-foreground')}>
        {formatDue(meeting.at, state.now)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-base font-medium">{meeting.title}</span>
        <span className="truncate text-xs text-muted-foreground">{projectLabel(state, meeting.projectId)}</span>
      </span>
      <span className="hidden -space-x-2 sm:flex">
        {meeting.participantIds.slice(0, 4).map((id) => (
          <span
            key={id}
            title={personName(state, id)}
            className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground"
          >
            {initials(personName(state, id))}
          </span>
        ))}
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
