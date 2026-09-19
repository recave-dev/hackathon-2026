import { Link, createFileRoute } from '@tanstack/react-router'
import {
  CheckIcon,
  ChevronDownIcon,
  LockIcon,
  MicIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  Share2Icon,
  SquareIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ORB_COLORS } from '@/components/app/tab-bar'
import { Section } from '@/components/app/screen'
import { SegmentLink } from '@/components/app/sources'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { formatDuration } from '@/demo/format'
import { SCRIPTED_TRANSCRIPT } from '@/demo/seed'
import { actions, useDemoState } from '@/demo/store'
import type { ExtractedItem, ExtractedKind, SessionMode, SessionPhase } from '@/demo/types'
import { cn } from '@/lib/utils'
import type { OrbState } from '@/registry/lib/orb-state'
import { NebulaOrb } from '@/registry/orbe/nebula-orb/nebula-orb'

export const Route = createFileRoute('/app/session')({ component: Session })

const ORB_STATE: Record<SessionPhase, OrbState> = {
  idle: 'idle',
  recording: 'listening',
  paused: 'connecting',
  processing: 'thinking',
  review: 'idle',
  saved: 'idle',
}

const PHASE_LABEL: Record<SessionPhase, string> = {
  idle: 'Gotowy',
  recording: 'Nagrywam',
  paused: 'Pauza',
  processing: 'Analizuję',
  review: 'Do przeglądu',
  saved: 'Zapisano',
}

const PROCESSING_MS = 2400

function Session() {
  const { session, notes } = useDemoState()
  const { phase } = session

  useEffect(() => {
    if (phase !== 'recording') return
    const id = window.setInterval(() => actions.tick(), 1000)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'processing') return
    const id = window.setTimeout(() => actions.finishProcessing(), PROCESSING_MS)
    return () => window.clearTimeout(id)
  }, [phase])

  const revealed = SCRIPTED_TRANSCRIPT.slice(0, session.revealed)
  const scriptDone = session.revealed >= SCRIPTED_TRANSCRIPT.length
  const isLive = phase === 'recording' || phase === 'paused'
  const savedNote = session.savedNoteId ? notes.find((n) => n.id === session.savedNoteId) : undefined

  return (
    <section className="flex flex-1 flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Session</h1>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
          <LockIcon className="size-3" /> Nagranie demonstracyjne
        </span>
      </header>

      <div className="flex flex-col items-center gap-4 pt-2">
        <div className="relative">
          <NebulaOrb
            state={ORB_STATE[phase]}
            size={phase === 'review' || phase === 'saved' ? 132 : 200}
            colorFrom={ORB_COLORS.from}
            colorTo={ORB_COLORS.to}
            label={`Blob: ${PHASE_LABEL[phase]}`}
            className="transition-[width,height] duration-500 motion-reduce:transition-none"
          />
        </div>
        <p role="status" aria-live="polite" className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {PHASE_LABEL[phase]}
          {isLive && <span className="ml-2 font-mono tabular-nums tracking-normal">{formatDuration(session.elapsedSec)}</span>}
        </p>
      </div>

      {phase === 'idle' && <IdleControls mode={session.mode} />}

      {isLive && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {phase === 'recording' ? (
              <Button variant="outline" size="lg" className="min-w-32" onClick={() => actions.pauseRecording()}>
                <PauseIcon /> Pauza
              </Button>
            ) : (
              <Button variant="outline" size="lg" className="min-w-32" onClick={() => actions.resumeRecording()}>
                <PlayIcon /> Wznów
              </Button>
            )}
            <Button size="lg" className="min-w-32" onClick={() => actions.stopRecording()}>
              <SquareIcon /> Zakończ
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {scriptDone
              ? 'Przygotowana wypowiedź dobiegła końca. Zakończ, żeby zobaczyć analizę.'
              : phase === 'paused'
                ? 'Licznik i transkrypcja są wstrzymane.'
                : 'Mikrofon nie jest używany — transkrypcja pojawia się z przygotowanego skryptu.'}
          </p>
        </div>
      )}

      {(isLive || phase === 'processing') && <Transcript segments={revealed} live={phase === 'recording'} />}

      {phase === 'processing' && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 text-center">
          <Spinner className="size-5 text-primary" aria-label="Przetwarzanie" />
          <p className="text-sm font-medium">Porządkuję notatkę</p>
          <p className="text-xs text-muted-foreground">
            Wyodrębniam ustalenia, zadania i kwestie do decyzji. Symulacja, ok. 2 sekundy.
          </p>
        </div>
      )}

      {phase === 'review' && <Review />}

      {phase === 'saved' && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <CheckIcon className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {savedNote?.visibility === 'private' ? 'Zapisano jako prywatną notatkę' : 'Zapisano i przekazano dalej'}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {savedNote?.visibility === 'private'
                  ? 'Notatka jest widoczna tylko dla Ciebie. Nie powstały zadania ani sprawy dla zespołu.'
                  : `Notatka powiązana z projektem Alfa. Utworzono ${savedNote?.taskIds.length ?? 0} zadanie i ${savedNote?.decisionIds.length ?? 0} sprawę do decyzji.`}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {savedNote?.decisionIds.map((id) => (
              <Button key={id} render={<Link to="/app/decisions/$decisionId" params={{ decisionId: id }} />}>
                Otwórz sprawę do decyzji
              </Button>
            ))}
            {savedNote && (
              <Button variant="outline" render={<Link to="/app/notes/$noteId" params={{ noteId: savedNote.id }} />}>
                Zobacz notatkę
              </Button>
            )}
            <Button variant="ghost" onClick={() => actions.newSession()}>
              Nowa sesja
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function IdleControls({ mode }: { mode: SessionMode }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <Tabs value={mode} onValueChange={(value) => actions.setSessionMode(value as SessionMode)}>
        <TabsList aria-label="Rodzaj nagrania" className="h-9">
          <TabsTrigger value="note" className="px-4">
            Moja notatka
          </TabsTrigger>
          <TabsTrigger value="meeting" className="px-4">
            Spotkanie
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
        {mode === 'note'
          ? 'Powiedz, co ustaliłeś i co trzeba zrobić. Wyodrębnię ustalenia, zadania i kwestie do decyzji.'
          : 'Nagraj spotkanie. Przygotuję podsumowanie, ustalenia i zadania dla uczestników.'}
      </p>
      <Button size="lg" className="h-12 min-w-52 rounded-full text-base" onClick={() => actions.startRecording()}>
        <MicIcon /> Zacznij mówić
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Aplikacja nie słucha mikrofonu. Odtworzę przygotowaną notatkę o rozmowie z Alfą.
      </p>
    </div>
  )
}

function Transcript({ segments, live }: { segments: typeof SCRIPTED_TRANSCRIPT; live: boolean }) {
  const [open, setOpen] = useState(false)
  const last = segments[segments.length - 1]

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-border bg-card">
      <CollapsibleTrigger
        className="flex w-full items-center justify-between gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-2xl"
        aria-label={open ? 'Zwiń transkrypcję' : 'Rozwiń transkrypcję'}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">
            Transkrypcja · {segments.length} {segments.length === 1 ? 'fragment' : segments.length < 5 ? 'fragmenty' : 'fragmentów'}
          </span>
          {!open && (
            <span className="truncate text-sm">
              {last ? last.text : live ? 'Słucham…' : 'Brak fragmentów.'}
            </span>
          )}
        </span>
        <ChevronDownIcon className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="flex flex-col gap-2 px-4 pb-4">
          {segments.map((segment) => (
            <li key={segment.id} className="flex gap-3 text-sm leading-relaxed motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1">
              <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{formatDuration(segment.at)}</span>
              <span>{segment.text}</span>
            </li>
          ))}
          {live && (
            <li className="flex gap-3 text-sm text-muted-foreground">
              <span className="w-10 shrink-0" />
              <span className="motion-safe:animate-pulse">…</span>
            </li>
          )}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}

const KIND_LABEL: Record<ExtractedKind, string> = {
  agreement: 'Ustalenie',
  proposal: 'Propozycja',
  task: 'Zadanie',
  decision: 'Do decyzji',
  missing: 'Brakuje',
}

const GROUPS: { title: string; kinds: ExtractedKind[]; hint?: string }[] = [
  { title: 'Ustalenia', kinds: ['agreement'], hint: 'Rzeczy, które według Ciebie zostały uzgodnione. Ustalenie ustne to nie decyzja ani zatwierdzony wydatek.' },
  { title: 'Propozycje i potrzeby', kinds: ['proposal'], hint: 'Zgłoszone, ale nieuzgodnione.' },
  { title: 'Zadania', kinds: ['task'] },
  { title: 'Kwestie wymagające decyzji', kinds: ['decision'], hint: 'Po przekazaniu dalej trafią do Decisions jako nowe sprawy.' },
  { title: 'Brakujące informacje', kinds: ['missing'] },
]

function Review() {
  const { session } = useDemoState()
  const segments = useMemo(() => SCRIPTED_TRANSCRIPT.slice(0, session.revealed), [session.revealed])
  const included = session.items.filter((i) => i.included).length

  const save = (visibility: 'private' | 'shared') => {
    actions.saveSession(visibility)
    toast.add({
      type: 'success',
      title: visibility === 'private' ? 'Zapisano prywatną notatkę' : 'Zapisano i przekazano dalej',
      description:
        visibility === 'private'
          ? 'Bez zmian w kolejce zespołu.'
          : 'Zadanie i sprawa do decyzji dodane. Sprawdź Home i Decisions.',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title="Podsumowanie" hint="Możesz poprawić treść przed zapisem.">
        <Textarea
          aria-label="Podsumowanie"
          value={session.summary}
          onChange={(e) => actions.updateSummary(e.target.value)}
          className="bg-card leading-relaxed"
        />
      </Section>

      {GROUPS.map((group) => {
        const items = session.items.filter((i) => group.kinds.includes(i.kind))
        if (items.length === 0) return null
        return (
          <Section key={group.title} title={group.title} hint={group.hint}>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <ReviewItem key={item.id} item={item} segments={segments} />
              ))}
            </ul>
          </Section>
        )
      })}

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          {included} z {session.items.length} elementów zostanie zapisanych. Wykluczone elementy nie tworzą zadań ani spraw.
        </p>
        <Button size="lg" className="w-full" onClick={() => save('shared')}>
          <Share2Icon /> Zapisz i przekaż dalej
        </Button>
        <Button size="lg" variant="outline" className="w-full" onClick={() => save('private')}>
          <LockIcon /> Zachowaj jako prywatną notatkę
        </Button>
      </div>
    </div>
  )
}

function ReviewItem({ item, segments }: { item: ExtractedItem; segments: typeof SCRIPTED_TRANSCRIPT }) {
  const [editing, setEditing] = useState(false)
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5 transition-opacity',
        !item.included && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{KIND_LABEL[item.kind]}</span>
          <SegmentLink segments={segments} segmentId={item.segmentId} />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only sm:not-sr-only">{item.included ? 'Uwzględnij' : 'Wykluczone'}</span>
          <Switch
            size="sm"
            checked={item.included}
            onCheckedChange={(checked) => actions.setItemIncluded(item.id, checked)}
            aria-label={`Uwzględnij: ${item.text}`}
          />
        </label>
      </div>
      {editing ? (
        <Textarea
          autoFocus
          aria-label="Treść elementu"
          value={item.text}
          onChange={(e) => actions.updateItemText(item.id, e.target.value)}
          onBlur={() => setEditing(false)}
          className="min-h-12 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex items-start justify-between gap-2 rounded-lg text-left text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`Edytuj: ${item.text}`}
        >
          <span className={cn(!item.included && 'line-through decoration-muted-foreground/60')}>{item.text}</span>
          <PencilIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      )}
      {item.note && <p className="text-xs leading-relaxed text-muted-foreground">{item.note}</p>}
    </li>
  )
}
