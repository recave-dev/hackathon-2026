import { useEffect, useRef } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { FACET_LABEL } from '@/demo/knowledge'
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

/** Graph entity id → label, for the rail; ids are shown when the catalog has not loaded. */
export type EntityLabels = Record<string, string>

export const expectedId = (u: Utterance): string | null | undefined => (u.expect === undefined ? undefined : (u.expect?.person ?? u.expect?.card ?? null))

export function TranscriptRail({ utterances, interim, debug, labels = {} }: { utterances: Utterance[]; interim?: string; debug: boolean; labels?: EntityLabels }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [utterances.length, interim])

  return (
    <ol className="flex flex-col gap-3">
      {utterances.length === 0 && !interim && <li className="text-sm text-muted-foreground">Transkrypcja pojawi się tutaj.</li>}
      {utterances.map((u) => (
        <UtteranceRow key={u.id} utterance={u} debug={debug} labels={labels} />
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

function UtteranceRow({ utterance, debug, labels }: { utterance: Utterance; debug: boolean; labels: EntityLabels }) {
  const r = utterance.result
  const shown = r?.action === 'show'
  const mentioned = r?.action === 'mention'
  const name = (id: string | null | undefined) => (id ? (labels[id] ?? id) : null)
  // Addressed lines are routed by intent; a shown card or person names the entity.
  const label = shown ? (r!.target === 'person' ? name(r!.person.id) : `${name(r!.topic.id)} · ${FACET_LABEL[r!.facet.id]}`) : r?.mode === 'command' ? `→ ${r.intent.id}` : null
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
          {utterance.dismissed && <span className="rounded-md bg-background/70 px-1.5 py-0.5">schowano</span>}
          {mentioned && r?.topic.id && <span className="rounded-md bg-background/70 px-1.5 py-0.5">wzmianka: {name(r.topic.id)}</span>}
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
          {r.person.confidence.toFixed(2)} · {r.facet.id}{r.mode === 'command' ? ` · intent ${r.intent.id} ${r.intent.confidence.toFixed(2)}` : ''}
          {r.error ? ` · błąd: ${r.error}` : ''}
        </p>
      )}
    </li>
  )
}
