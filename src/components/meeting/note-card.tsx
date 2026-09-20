import { CheckCircle2Icon, CircleHelpIcon, ListChecksIcon, NotebookPenIcon } from 'lucide-react'

import { Panel, Pill } from '@/components/desktop/page'
import type { NoteResult, TranscriptLine } from '@/server/meeting-assist'
import { cn } from '@/lib/utils'

const SCOPE_LABEL: Record<NoteResult['scope'], string> = { last_topic: 'ostatni temat', whole: 'całe spotkanie', range: 'fragment' }

/** Notes Bolek took from the conversation itself, with the turns it read. */
export function NoteCardView({ note, transcript, triggeredBy, debug, className }: { note: NoteResult; transcript: TranscriptLine[]; triggeredBy?: { speaker: string; text: string }; debug?: boolean; className?: string }) {
  const covered = transcript.filter((l) => note.coveredIds.includes(l.id))
  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">
            <NotebookPenIcon className="size-3" /> Notatka ze spotkania
          </Pill>
          <span>{SCOPE_LABEL[note.scope]}</span>
          {covered.length > 0 && <span>· {covered.length} wypowiedzi</span>}
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{note.title}</h1>
        {triggeredBy && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-border bg-card p-6">
        {note.bullets.length === 0 ? (
          <p className="text-base text-muted-foreground">Nie znalazłem w rozmowie nic, co dałoby się streścić.</p>
        ) : (
          <ul className="flex flex-col gap-2.5 text-lg leading-relaxed">
            {note.bullets.map((b) => (
              <li key={b} className="flex gap-3">
                <span aria-hidden className="mt-[0.7em] size-2 shrink-0 rounded-full bg-primary/70" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        <Panel title="Ustalenia" className={cn(note.decisions.length === 0 && 'opacity-60')}>
          {note.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {note.decisions.map((d) => (
                <li key={d} className="flex gap-2">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Zadania" className={cn(note.actionItems.length === 0 && 'opacity-60')}>
          {note.actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {note.actionItems.map((a) => (
                <li key={`${a.who}-${a.what}`} className="flex gap-2">
                  <ListChecksIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    {a.who && <span className="font-medium">{a.who}: </span>}
                    {a.what}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Otwarte" className={cn(note.openQuestions.length === 0 && 'opacity-60')}>
          {note.openQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {note.openQuestions.map((q) => (
                <li key={q} className="flex gap-2">
                  <CircleHelpIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {covered.length > 0 && (
        <Panel title="Na podstawie" caption="Wypowiedzi, z których powstała notatka.">
          <ol className="flex flex-col divide-y divide-border">
            {covered.map((l) => (
              <li key={l.id} className="flex gap-3 py-2 text-sm first:pt-0 last:pb-0">
                <span className="w-28 shrink-0 truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{l.speaker}</span>
                <span className="text-foreground/85">{l.text}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {debug && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {note.model} · {note.latencyMs} ms
        </p>
      )}
    </article>
  )
}
