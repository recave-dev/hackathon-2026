import { useEffect, useRef } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { FACET_LABEL, cardById } from '@/demo/knowledge'
import { personCardById } from '@/demo/people'
import { ASSISTANT_NAME } from '@/lib/wake-word'
import type { RelevanceResult } from '@/server/meeting-assist'
import { cn } from '@/lib/utils'

export interface Utterance {
  id: string
  speaker: string
  text: string
  /** Wall-clock ms when it was said. */
  at: number
  /** True when the line was addressed to the assistant (wake word or armed follow-up). */
  addressed?: boolean
  /** Expected outcome for scripted lines, for the self-check. */
  expect?: { card?: string; person?: string; facet?: string } | null
  result?: RelevanceResult
  pending?: boolean
  /** Line was not judged at all (wake mode, not addressed). */
  skipped?: boolean
  /** "Bolek, dzięki": handled locally by hiding the card. */
  dismissed?: boolean
}

/** What the assistant showed for this utterance, as an id, or null. */
export const shownId = (r: RelevanceResult | undefined): string | null => {
  if (!r || r.action !== 'show') return null
  return r.target === 'person' ? r.person.id : r.topic.id
}

export const expectedId = (u: Utterance): string | null | undefined => (u.expect === undefined ? undefined : (u.expect?.person ?? u.expect?.card ?? null))

export function TranscriptRail({ utterances, interim, debug }: { utterances: Utterance[]; interim?: string; debug: boolean }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [utterances.length, interim])

  return (
    <ol className="flex flex-col gap-3">
      {utterances.length === 0 && !interim && <li className="text-sm text-muted-foreground">Transkrypcja pojawi się tutaj.</li>}
      {utterances.map((u) => (
        <UtteranceRow key={u.id} utterance={u} debug={debug} />
      ))}
      {interim && (
        <li className="flex flex-col gap-1 rounded-xl border border-dashed border-border px-3 py-2.5">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Słyszę…</span>
          <span className="text-sm leading-relaxed text-muted-foreground">{interim}</span>
        </li>
      )}
      <div ref={end} />
    </ol>
  )
}

function UtteranceRow({ utterance, debug }: { utterance: Utterance; debug: boolean }) {
  const r = utterance.result
  const shown = r?.action === 'show'
  const mentioned = r?.action === 'mention'
  const card = cardById(r?.topic.id)
  const person = personCardById(r?.person.id)
  const label = shown ? (r!.target === 'person' ? person?.name : card ? `${card.title} · ${FACET_LABEL[r!.facet.id]}` : null) : null
  const expected = expectedId(utterance)
  const check = expected === undefined ? undefined : expected === shownId(r)

  return (
    <li
      className={cn(
        'flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors',
        shown ? 'bg-accent text-accent-foreground ring-1 ring-ring/40' : mentioned ? 'bg-muted/60' : 'bg-transparent',
        utterance.addressed && !shown && 'ring-1 ring-ring/30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {utterance.speaker}
          {utterance.addressed && <span className="rounded bg-primary/10 px-1 py-px text-[10px] tracking-normal text-primary normal-case">do {ASSISTANT_NAME}</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {utterance.pending && <Spinner className="size-3" />}
          {label && <span className="rounded-md bg-background/70 px-1.5 py-0.5 font-medium text-foreground">{label}</span>}
          {utterance.addressed && r && r.action === 'none' && <span className="rounded-md bg-background/70 px-1.5 py-0.5">nie znalazłem</span>}
          {utterance.dismissed && <span className="rounded-md bg-background/70 px-1.5 py-0.5">schowano</span>}
          {mentioned && card && <span className="rounded-md bg-background/70 px-1.5 py-0.5">wzmianka: {card.title}</span>}
          {debug && check !== undefined && (r || utterance.skipped) && (
            <span className={cn('font-mono', check ? 'text-primary' : 'text-destructive')} title={check ? 'zgodne z oczekiwaniem' : `oczekiwano: ${expected ?? 'nic'}`}>
              {check ? '✓' : '✗'}
            </span>
          )}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{utterance.text}</p>
      {debug && r && (
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          {r.engine}
          {r.via ? `/${r.via}` : ''} · {r.mode} · {r.latencyMs} ms · info {r.needsInfo.toFixed(2)} · topic {r.topic.id ?? 'none'} {r.topic.confidence.toFixed(2)} · person {r.person.id ?? 'none'}{' '}
          {r.person.confidence.toFixed(2)} · {r.facet.id}
          {r.error ? ` · błąd: ${r.error}` : ''}
        </p>
      )}
    </li>
  )
}
