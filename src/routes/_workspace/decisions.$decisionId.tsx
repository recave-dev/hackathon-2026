import { Link, createFileRoute } from '@tanstack/react-router'
import { CheckCircle2Icon, CircleDashedIcon, ClockIcon, FilesIcon, SmartphoneIcon } from 'lucide-react'

import { SourceList } from '@/components/app/sources'
import { BulletList, PageHeader, Panel, Pill } from '@/components/desktop/page'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatDue, isOverdue } from '@/demo/format'
import { STATUS_LABEL, personName, projectLabel } from '@/demo/selectors'
import { useDemoState, useHydrated } from '@/demo/store'
import type { Decision, DemoState } from '@/demo/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_workspace/decisions/$decisionId')({
  staticData: {
    crumb: (params, state) => state.decisions.find((d) => d.id === params.decisionId)?.title ?? 'Sprawa',
  },
  component: DecisionDetail,
})

function DecisionDetail() {
  const { decisionId } = Route.useParams()
  const state = useDemoState()
  const hydrated = useHydrated()
  const decision = state.decisions.find((d) => d.id === decisionId)
  if (!decision) {
    return hydrated ? <PageHeader title="Nie znaleziono sprawy" description="Sprawdź adres albo wróć do listy." /> : null
  }
  return <DecisionView decision={decision} state={state} />
}

function DecisionView({ decision, state }: { decision: Decision; state: DemoState }) {
  const isPending = decision.status === 'pending'
  const actionable = isPending || decision.status === 'snoozed'
  const overdue = isPending && isOverdue(decision.dueAt, state.now)
  const chosen = decision.options.find((o) => o.id === decision.chosenOptionId)

  return (
    <>
      <PageHeader
        eyebrow={projectLabel(state, decision.projectId)}
        title={decision.title}
        description={decision.why}
        meta={
          <>
            <Pill tone={isPending ? 'accent' : 'muted'}>{STATUS_LABEL[decision.status]}</Pill>
            {isPending && (
              <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}>
                <ClockIcon className="size-3.5" /> reakcja do {formatDue(decision.dueAt, state.now)}
              </span>
            )}
            {decision.status === 'snoozed' && decision.snoozedUntil && (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="size-3.5" /> wraca {formatDue(decision.snoozedUntil, state.now)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <FilesIcon className="size-3.5" /> {decision.sourceIds.length} źródeł
            </span>
          </>
        }
        action={
          actionable ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/app/decisions/$decisionId" params={{ decisionId: decision.id }} />}
            >
              <SmartphoneIcon /> Zdecyduj w widoku mobilnym
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {!actionable && (
            <Panel title={decision.status === 'delegated' ? 'Delegowano' : 'Podjęta decyzja'}>
              <div className="flex flex-col gap-1">
                <p className="text-base font-medium">
                  {decision.status === 'delegated' ? `Decyzję podejmie ${personName(state, decision.delegatedToId)}` : chosen?.label ?? 'Własna instrukcja'}
                </p>
                {decision.decidedAt && <p className="text-xs text-muted-foreground">{formatDateTime(decision.decidedAt)}</p>}
                {decision.customInstruction && <p className="text-sm leading-relaxed text-muted-foreground">„{decision.customInstruction}”</p>}
                {decision.rationale && <p className="text-sm leading-relaxed text-muted-foreground">{decision.rationale}</p>}
              </div>
            </Panel>
          )}

          {decision.outcome && (
            <Panel title="Prognoza a wynik" caption={decision.outcome.metric}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted p-4">
                  <p className="text-[11px] text-muted-foreground">Prognoza</p>
                  <p className="text-3xl font-semibold tabular-nums">{decision.outcome.forecast}</p>
                </div>
                <div className="rounded-xl bg-accent p-4 text-accent-foreground">
                  <p className="text-[11px] opacity-80">Wynik ({formatDateTime(decision.outcome.measuredAt)})</p>
                  <p className="text-3xl font-semibold tabular-nums">{decision.outcome.actual}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1 border-t border-border pt-3">
                <p className="text-xs font-medium">Lekcja</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{decision.outcome.lesson}</p>
              </div>
            </Panel>
          )}

          <Panel title="Kontekst i potwierdzone fakty">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Kontekst</p>
                <BulletList items={decision.context} />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Potwierdzone w źródłach</p>
                <BulletList items={decision.facts} />
              </div>
            </div>
          </Panel>

          <Panel title="Niewiadome i założenia">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Niewiadome</p>
                <BulletList items={decision.unknowns} />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Założenia</p>
                <BulletList items={decision.assumptions} />
              </div>
            </div>
          </Panel>

          {decision.options.length > 0 && (
            <Panel title={actionable ? 'Możliwe działania' : 'Rozważane opcje'} caption={actionable ? 'Wybór i zatwierdzenie odbywa się w widoku mobilnym.' : undefined}>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {decision.options.map((o) => {
                  const isChosen = o.id === decision.chosenOptionId
                  return (
                    <li key={o.id} className={cn('flex flex-col gap-3 rounded-xl border bg-background/40 p-4', isChosen ? 'border-primary ring-1 ring-primary/40' : 'border-border')}>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-medium leading-snug">
                          {o.label}
                          {isChosen && <span className="ml-2 text-xs font-normal text-primary">wybrana</span>}
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground">{o.description}</p>
                      </div>
                      <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
                        <Consequence label="Czas" value={o.consequences.time} />
                        <Consequence label="Koszt" value={o.consequences.cost} />
                        <Consequence label="Ryzyko" value={o.consequences.risk} />
                      </dl>
                      {o.requiresConsent && <p className="text-xs text-muted-foreground">{o.requiresConsent}</p>}
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          {decision.agentPlan && (
            <Panel title="Co wykona agent po zatwierdzeniu">
              <p className="text-sm leading-relaxed text-muted-foreground">{decision.agentPlan}</p>
            </Panel>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          {decision.execution.length > 0 && (
            <Panel title="Realizacja">
              <ol className="flex flex-col gap-2">
                {decision.execution.map((step) => (
                  <li key={step.id} className="flex items-start gap-2.5 text-sm">
                    {step.status === 'done' ? (
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Wykonane" />
                    ) : (
                      <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="W toku" />
                    )}
                    <span className={cn(step.status === 'waiting' && 'text-muted-foreground')}>{step.label}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {decision.questions.length > 0 && (
            <Panel title="Pytania">
              <ul className="flex flex-col gap-2">
                {decision.questions.map((q) => (
                  <li key={q.id} className="flex flex-col gap-1.5 rounded-xl border border-border p-3.5 text-sm">
                    <p className="text-xs text-muted-foreground">
                      Do: {personName(state, q.toId)} · {formatDateTime(q.askedAt)}
                    </p>
                    <p className="leading-relaxed">{q.text}</p>
                    {q.answer ? (
                      <p className="rounded-lg bg-muted p-2.5 leading-relaxed">{q.answer}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Oczekiwanie na odpowiedź…</p>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Źródła" caption="Fragmenty maili, dokumentów i transkrypcji.">
            <SourceList sourceIds={decision.sourceIds} />
          </Panel>
        </aside>
      </div>
    </>
  )
}

function Consequence({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <dt className="w-12 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="leading-snug">{value}</dd>
    </div>
  )
}
