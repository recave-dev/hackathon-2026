import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowUpRightIcon, BotIcon, CalendarIcon, ChevronRightIcon, UserIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EntityLink } from '@/components/app/entity-link'
import { EmptyHint, Screen, Section } from '@/components/app/screen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import {
  firstName,
  formatDue,
  formatLongDate,
  formatRelativeDay,
  formatTime,
  greetingFor,
  parseLocal,
  plural,
} from '@/demo/format'
import { inProgressDecisions, openTasks, pendingDecisions, personName, projectLabel } from '@/demo/selectors'
import { actions, useDemoState } from '@/demo/store'
import type { Activity } from '@/demo/types'

export const Route = createFileRoute('/app/home')({ component: Home })

function Home() {
  const state = useDemoState()
  const user = state.people.find((p) => p.id === state.userId)
  const pending = useMemo(() => pendingDecisions(state), [state])
  const nearest = pending[0]
  const meeting = state.meetings
    .filter((m) => parseLocal(m.at).getTime() >= parseLocal(state.now).getTime() - 60 * 60_000)
    .sort((a, b) => parseLocal(a.at).getTime() - parseLocal(b.at).getTime())[0]
  const activities = state.activities.slice(0, 5)
  const inProgress = inProgressDecisions(state)
  const tasks = openTasks(state)
  const changes = [...state.changes].sort((a, b) => parseLocal(b.at).getTime() - parseLocal(a.at).getTime()).slice(0, 3)

  return (
    <Screen
      eyebrow={formatLongDate(state.now)}
      title={`${greetingFor(state.now)}, ${user ? firstName(user.name) : ''}`}
      description={`Zegar demo: ${formatTime(state.now)}. Oto, co dziś wymaga Twojej uwagi.`}
    >
      <Link
        to="/app/decisions"
        search={{ filter: 'pending' }}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-2xl font-semibold tabular-nums text-accent-foreground">
          {pending.length}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">
            {pending.length === 0
              ? 'Brak spraw do decyzji'
              : `${plural(pending.length, 'sprawa wymaga', 'sprawy wymagają', 'spraw wymaga')} decyzji`}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {nearest ? `Najbliższy termin: ${formatDue(nearest.dueAt, state.now)} · ${nearest.title}` : 'Kolejka jest pusta.'}
          </span>
        </span>
        <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      <Section title="Co się zmieniło">
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
          {changes.map((change) => {
            const inner = (
              <span className="flex items-start gap-3 p-3.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm leading-snug font-medium">{change.text}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{change.detail}</span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    {formatRelativeDay(change.at, state.now)}, {formatTime(change.at)}
                  </span>
                </span>
                {change.link && <ArrowUpRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              </span>
            )
            return (
              <li key={change.id}>
                {change.link ? (
                  <EntityLink link={change.link} className="block rounded-2xl transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 outline-none">
                    {inner}
                  </EntityLink>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="Najbliższe spotkanie">
        {meeting ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarIcon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <p className="text-sm font-medium leading-snug">{meeting.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeDay(meeting.at, state.now)} {formatTime(meeting.at)} · {projectLabel(state, meeting.projectId)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {meeting.participantIds.map((id) => firstName(personName(state, id))).join(', ')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              render={<Link to="/app/meetings/$meetingId" params={{ meetingId: meeting.id }} />}
              className="w-full"
            >
              Otwórz briefing
            </Button>
          </div>
        ) : (
          <EmptyHint>Brak nadchodzących spotkań.</EmptyHint>
        )}
      </Section>

      <Section title="W toku" hint="Zadania i sprawy, które czekają na kogoś innego.">
        {tasks.length === 0 && inProgress.length === 0 ? (
          <EmptyHint>Nic nie czeka w tle.</EmptyHint>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3 p-3.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <UserIcon className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm leading-snug">{task.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {firstName(personName(state, task.ownerId))} · termin {formatDue(task.dueAt, state.now)}
                  </span>
                </span>
              </li>
            ))}
            {inProgress.map((decision) => {
              const waiting = decision.execution.find((s) => s.status === 'waiting')
              return (
                <li key={decision.id}>
                  <Link
                    to="/app/decisions/$decisionId"
                    params={{ decisionId: decision.id }}
                    className="flex items-start gap-3 p-3.5 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <BotIcon className="size-3.5" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm leading-snug">{decision.title}</span>
                      <span className="text-xs text-muted-foreground">{waiting?.label}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Ostatnie działania">
        <ol className="flex flex-col gap-1">
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} now={state.now} />
          ))}
        </ol>
      </Section>

      <ResetDemo />
    </Screen>
  )
}

function ActivityRow({ activity, now }: { activity: Activity; now: string }) {
  const content = (
    <span className="flex items-start gap-3 rounded-xl px-1 py-2">
      <span className="w-[4.5rem] shrink-0 pt-0.5 text-[11px] leading-snug text-muted-foreground tabular-nums">
        {formatRelativeDay(activity.at, now)}
        <br />
        {formatTime(activity.at)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm leading-snug">{activity.text}</span>
        <span className="text-[11px] text-muted-foreground">
          {activity.actor === 'agent' ? 'Agent' : activity.actor === 'user' ? 'Ty' : 'System'}
        </span>
      </span>
    </span>
  )
  return (
    <li>
      {activity.link ? (
        <EntityLink link={activity.link} className="block rounded-xl transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 outline-none">
          {content}
        </EntityLink>
      ) : (
        content
      )}
    </li>
  )
}

function ResetDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex justify-center pt-2 pb-4">
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        Resetuj demo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zresetować demo?</DialogTitle>
            <DialogDescription>
              Przywraca dane początkowe, zegar (10 listopada 2026, 09:00) i statusy spraw. Zapisane notatki i decyzje z tej sesji znikną.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={() => {
                actions.resetDemo()
                setOpen(false)
                toast.add({ title: 'Demo zresetowane', description: 'Stan początkowy przywrócony.', type: 'success' })
              }}
            >
              Resetuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
