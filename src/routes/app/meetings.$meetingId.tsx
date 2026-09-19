import { Link, createFileRoute } from '@tanstack/react-router'

import { BulletList, Screen, Section } from '@/components/app/screen'
import { SourceList } from '@/components/app/sources'
import { Button } from '@/components/ui/button'
import { formatLongDate, formatTime } from '@/demo/format'
import { personName, projectLabel } from '@/demo/selectors'
import { useDemoState } from '@/demo/store'

export const Route = createFileRoute('/app/meetings/$meetingId')({ component: MeetingBriefing })

function MeetingBriefing() {
  const { meetingId } = Route.useParams()
  const state = useDemoState()
  const meeting = state.meetings.find((m) => m.id === meetingId)
  if (!meeting) return <Screen title="Nie znaleziono spotkania" back={{ to: '/app/home', label: 'Home' }} />

  const relatedDecisions = state.decisions.filter(
    (d) => d.projectId === meeting.projectId && (d.status === 'pending' || d.status === 'snoozed'),
  )

  return (
    <Screen
      back={{ to: '/app/home', label: 'Home' }}
      eyebrow={`Briefing · ${formatLongDate(meeting.at)}, ${formatTime(meeting.at)}`}
      title={meeting.title}
      description={projectLabel(state, meeting.projectId)}
    >
      <Section title="Cel spotkania">
        <p className="text-sm leading-relaxed">{meeting.goal}</p>
      </Section>

      <Section title="Uczestnicy">
        <ul className="flex flex-col gap-1.5">
          {meeting.participantIds.map((id) => {
            const person = state.people.find((p) => p.id === id)
            return (
              <li key={id} className="flex items-center justify-between gap-3 text-sm">
                <span>{personName(state, id)}</span>
                <span className="text-xs text-muted-foreground">
                  {person?.role}
                  {person?.company ? ` · ${person.company}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="Wcześniejsze ustalenia">
        <BulletList items={meeting.priorAgreements} />
      </Section>

      <Section title="Otwarte kwestie">
        <BulletList items={meeting.openIssues} />
        {relatedDecisions.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            {relatedDecisions.map((d) => (
              <Button
                key={d.id}
                variant="outline"
                className="w-full justify-between"
                render={<Link to="/app/decisions/$decisionId" params={{ decisionId: d.id }} />}
              >
                <span className="truncate">Do decyzji: {d.title}</span>
              </Button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Źródła" hint="Fragmenty dokumentów, maili i notatek, na których opiera się briefing.">
        <SourceList sourceIds={meeting.sourceIds} />
      </Section>

      <Button variant="outline" className="mb-4" render={<Link to="/app/session" />}>
        Nagraj notatkę po spotkaniu
      </Button>
    </Screen>
  )
}
