import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2Icon, CircleDashedIcon, ClockIcon, FilesIcon, MessageCircleQuestionIcon, UserPlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AskDialog, DelegateDialog, SnoozeDialog } from '@/components/app/decision-dialogs'
import { BulletList, DemoTag, Screen, Section } from '@/components/app/screen'
import { SourceList } from '@/components/app/sources'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { formatDateTime, formatDue, isOverdue } from '@/demo/format'
import { STATUS_LABEL, personName, projectLabel } from '@/demo/selectors'
import { actions, useDemoState, useHydrated } from '@/demo/store'
import type { Decision, DecisionOption } from '@/demo/types'
import { cn } from '@/lib/utils'

type Section = 'options' | 'context' | 'sources'
const SECTIONS: Section[] = ['options', 'context', 'sources']

export const Route = createFileRoute('/app/decisions/$decisionId')({
  validateSearch: (search: Record<string, unknown>): { section?: Section } =>
    SECTIONS.includes(search.section as Section) ? { section: search.section as Section } : {},
  component: DecisionDetail,
})

const ANSWER_DELAY_MS = 3000

function DecisionDetail() {
  const { decisionId } = Route.useParams()
  const { section } = Route.useSearch()
  const state = useDemoState()
  const hydrated = useHydrated()
  const decision = state.decisions.find((d) => d.id === decisionId)
  // Decisions created in this browser only exist in the persisted client state,
  // so "not found" is only meaningful once that state has been loaded.
  if (!decision) {
    return hydrated ? <Screen title="Nie znaleziono sprawy" back={{ to: '/app/decisions', label: 'Decisions' }} /> : null
  }
  return <DecisionView decision={decision} now={state.now} section={section} />
}

function DecisionView({ decision, now, section }: { decision: Decision; now: string; section?: Section }) {
  const state = useDemoState()
  const isPending = decision.status === 'pending'

  useEffect(() => {
    if (!section) return
    const el = document.getElementById(`section-${section}`)
    el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }, [section, decision.id])

  // Simulated replies: any unanswered question gets an answer a few seconds after it appears.
  const unanswered = decision.questions.find((q) => !q.answer)
  useEffect(() => {
    if (!unanswered) return
    const id = window.setTimeout(() => actions.answerQuestion(decision.id, unanswered.id), ANSWER_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [decision.id, unanswered])

  const overdue = isPending && isOverdue(decision.dueAt, now)
  const chosen = decision.options.find((o) => o.id === decision.chosenOptionId)

  return (
    <Screen
      back={{ to: '/app/decisions', label: 'Decisions' }}
      eyebrow={projectLabel(state, decision.projectId)}
      title={decision.title}
      description={decision.why}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="rounded-md bg-accent px-1.5 py-0.5 font-medium text-accent-foreground">{STATUS_LABEL[decision.status]}</span>
        {isPending && (
          <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}>
            <ClockIcon className="size-3.5" /> reakcja do {formatDue(decision.dueAt, now)}
          </span>
        )}
        {decision.status === 'snoozed' && decision.snoozedUntil && (
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3.5" /> wraca {formatDue(decision.snoozedUntil, now)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <FilesIcon className="size-3.5" /> {decision.sourceIds.length} źródeł
        </span>
      </div>

      {decision.status === 'snoozed' && (
        <Button variant="outline" onClick={() => actions.unsnoozeDecision(decision.id)}>
          Przywróć do kolejki
        </Button>
      )}

      {!isPending && decision.status !== 'snoozed' && (
        <Section title={decision.status === 'delegated' ? 'Delegowano' : 'Podjęta decyzja'}>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {decision.status === 'delegated'
                  ? `Decyzję podejmie ${personName(state, decision.delegatedToId)}`
                  : chosen?.label ?? 'Własna instrukcja'}
              </p>
              {decision.decidedAt && <p className="text-xs text-muted-foreground">{formatDateTime(decision.decidedAt)}</p>}
              {decision.customInstruction && (
                <p className="text-sm leading-relaxed text-muted-foreground">„{decision.customInstruction}”</p>
              )}
              {decision.rationale && <p className="text-sm leading-relaxed text-muted-foreground">{decision.rationale}</p>}
            </div>
            {decision.execution.length > 0 && (
              <ol className="flex flex-col gap-2 border-t border-border pt-3">
                {decision.execution.map((step) => (
                  <li key={step.id} className="flex items-start gap-2.5 text-sm">
                    {step.status === 'done' ? (
                      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Wykonane" />
                    ) : (
                      <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:animate-[spin_6s_linear_infinite]" aria-label="W toku" />
                    )}
                    <span className={cn(step.status === 'waiting' && 'text-muted-foreground')}>
                      {step.label}
                      {step.status === 'waiting' && <span className="ml-1.5 text-xs">· w toku</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {decision.execution.some((s) => s.status === 'waiting') && (
              <p className="text-xs text-muted-foreground">
                Decyzja jest podjęta, ale realizacja nie jest zakończona — czekamy na kogoś z zewnątrz.
              </p>
            )}
          </div>
        </Section>
      )}

      {decision.outcome && (
        <Section title="Prognoza a wynik">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{decision.outcome.metric}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted p-3">
                <p className="text-[11px] text-muted-foreground">Prognoza (maj 2026)</p>
                <p className="text-2xl font-semibold tabular-nums">{decision.outcome.forecast}</p>
              </div>
              <div className="rounded-xl bg-accent p-3 text-accent-foreground">
                <p className="text-[11px] opacity-80">Wynik ({formatDateTime(decision.outcome.measuredAt)})</p>
                <p className="text-2xl font-semibold tabular-nums">{decision.outcome.actual}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <p className="text-xs font-medium">Lekcja</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{decision.outcome.lesson}</p>
            </div>
            <DemoTag>Dane demo — wynik nie mówi, czy inna opcja byłaby lepsza.</DemoTag>
          </div>
        </Section>
      )}

      <Section id="section-context" title="Kontekst i potwierdzone fakty">
        <BulletList items={decision.context} />
        {decision.facts.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Potwierdzone w źródłach</p>
            <BulletList items={decision.facts} />
          </div>
        )}
      </Section>

      <Section title="Niewiadome i założenia">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Niewiadome</p>
            <BulletList items={decision.unknowns} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Założenia</p>
            <BulletList items={decision.assumptions} />
          </div>
        </div>
      </Section>

      {decision.questions.length > 0 && (
        <Section title="Pytania">
          <ul className="flex flex-col gap-2">
            {decision.questions.map((q) => (
              <li key={q.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 text-sm">
                <p className="text-xs text-muted-foreground">
                  Do: {personName(state, q.toId)} · {formatDateTime(q.askedAt)}
                </p>
                <p className="leading-relaxed">{q.text}</p>
                {q.answer ? (
                  <p className="rounded-lg bg-muted p-2.5 leading-relaxed">
                    <span className="text-xs font-medium text-muted-foreground">Odpowiedź (symulowana): </span>
                    {q.answer}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground motion-safe:animate-pulse">Oczekiwanie na odpowiedź…</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {isPending ? (
        <Options decision={decision} />
      ) : (
        decision.options.length > 0 &&
        decision.status !== 'snoozed' && (
          <Section title="Rozważane opcje">
            <ul className="flex flex-col gap-2">
              {decision.options.map((o) => (
                <li key={o.id} className={cn('rounded-xl border border-border bg-card p-3.5 text-sm', o.id === decision.chosenOptionId && 'border-primary/50')}>
                  <p className="font-medium">{o.label}</p>
                  <p className="text-muted-foreground">{o.description}</p>
                </li>
              ))}
            </ul>
          </Section>
        )
      )}

      {decision.status === 'snoozed' && <Options decision={decision} />}

      <Section id="section-sources" title="Źródła" hint="Fragmenty maili, dokumentów i transkrypcji. Transkrypcję można otworzyć w miejscu cytatu.">
        <SourceList sourceIds={decision.sourceIds} />
      </Section>
    </Screen>
  )
}

function Consequence({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-xs leading-snug">{value}</dd>
    </div>
  )
}

function OptionCard({ option, selected, onSelect, disabled }: { option: DecisionOption; selected: boolean; onSelect: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-2.5 rounded-2xl border bg-card p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60',
        selected ? 'border-primary ring-1 ring-primary/40' : 'border-border hover:border-primary/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium leading-snug">{option.label}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{option.description}</p>
        </div>
        <span
          aria-hidden
          className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', selected ? 'border-primary' : 'border-input')}
        >
          {selected && <span className="size-2 rounded-full bg-primary" />}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-2.5">
        <Consequence label="Czas" value={option.consequences.time} />
        <Consequence label="Koszt" value={option.consequences.cost} />
        <Consequence label="Ryzyko" value={option.consequences.risk} />
      </dl>
      {option.requiresConsent && <p className="text-xs text-muted-foreground">{option.requiresConsent}</p>}
    </button>
  )
}

function Options({ decision }: { decision: Decision }) {
  const isPending = decision.status === 'pending'
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const option = decision.options.find((o) => o.id === selected)
  const isCustom = selected === 'custom'
  const canApprove = isPending && (Boolean(option) || (isCustom && custom.trim().length > 3))
  const preview = option ? option.execution : [{ label: 'Instrukcja przekazana agentowi', status: 'done' as const }, { label: 'Szkic działań do Twojej akceptacji', status: 'waiting' as const }]

  const approve = () => {
    if (submitting || !canApprove) return
    setSubmitting(true)
    actions.approveDecision(decision.id, isCustom ? 'custom' : (selected as string), isCustom ? custom : undefined)
    setConfirmOpen(false)
    toast.add({ type: 'success', title: 'Decyzja zatwierdzona', description: 'Agent uruchomił symulowane działania. Sprawa jest w Historii.' })
  }

  return (
    <>
      <Section
        id="section-options"
        title="Możliwe działania"
        hint={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Wybór opcji nic nie uruchamia — potrzebne jest osobne zatwierdzenie. <DemoTag />
          </span>
        }
      >
        <div role="radiogroup" aria-label="Opcje decyzji" className="flex flex-col gap-2.5">
          {decision.options.map((o) => (
            <OptionCard key={o.id} option={o} selected={selected === o.id} onSelect={() => setSelected(o.id)} disabled={!isPending} />
          ))}
          <div
            className={cn(
              'flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors',
              isCustom ? 'border-primary ring-1 ring-primary/40' : 'border-border',
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isCustom}
              disabled={!isPending}
              onClick={() => setSelected('custom')}
              className="flex items-start justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg disabled:opacity-60"
            >
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">D. Własna instrukcja</p>
                <p className="text-sm text-muted-foreground">Opisz, co ma zrobić agent. Dostaniesz szkic do akceptacji.</p>
              </div>
              <span aria-hidden className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', isCustom ? 'border-primary' : 'border-input')}>
                {isCustom && <span className="size-2 rounded-full bg-primary" />}
              </span>
            </button>
            {isCustom && (
              <Textarea
                autoFocus
                aria-label="Własna instrukcja"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Np. zaproponuj szkolenie w cenie, ale tylko dla jednej grupy; drugą wyceń osobno."
              />
            )}
          </div>
        </div>
      </Section>

      <Section title="Co wykona agent po zatwierdzeniu">
        <p className="text-sm leading-relaxed text-muted-foreground">{decision.agentPlan}</p>
      </Section>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3">
        <Button size="lg" className="w-full" disabled={!canApprove} onClick={() => setConfirmOpen(true)}>
          {selected ? 'Zatwierdź wybraną opcję' : 'Wybierz opcję, aby zatwierdzić'}
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => setAskOpen(true)}>
            <MessageCircleQuestionIcon /> Dopytaj
          </Button>
          <Button variant="outline" disabled={!isPending} onClick={() => setDelegateOpen(true)}>
            <UserPlusIcon /> Deleguj
          </Button>
          <Button variant="outline" onClick={() => setSnoozeOpen(true)}>
            <ClockIcon /> Odłóż
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zatwierdzić decyzję?</DialogTitle>
            <DialogDescription>{option ? option.label : 'Własna instrukcja'}</DialogDescription>
          </DialogHeader>
          {isCustom && <p className="rounded-lg bg-muted p-2.5 text-sm leading-relaxed">„{custom.trim()}”</p>}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Agent wykona (symulacja):</p>
            <ul className="flex flex-col gap-1 text-sm">
              {preview.map((s) => (
                <li key={s.label} className="flex items-start gap-2">
                  {s.status === 'done' ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" /> : <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
            {option?.requiresConsent && <p className="text-xs text-muted-foreground">{option.requiresConsent} Realizacja pozostanie w toku do potwierdzenia.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Wróć
            </Button>
            <Button onClick={approve} disabled={submitting}>
              Zatwierdzam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AskDialog decision={decision} open={askOpen} onOpenChange={setAskOpen} />
      <DelegateDialog decision={decision} open={delegateOpen} onOpenChange={setDelegateOpen} />
      <SnoozeDialog decision={decision} open={snoozeOpen} onOpenChange={setSnoozeOpen} />
    </>
  )
}
