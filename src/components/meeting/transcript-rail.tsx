import { useEffect, useRef } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { FACET_LABEL, cardById } from '@/demo/knowledge'
import type { RelevanceResult } from '@/server/meeting-assist'
import { cn } from '@/lib/utils'

export interface Utterance {
  id: string
  speaker: string
  text: string
  /** Wall-clock ms when it was said. */
  at: number
  /** Expected card for scripted lines, for the self-check. */
  expect?: { card: string; facet?: string } | null
  result?: RelevanceResult
  pending?: boolean
}

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
  const expectedCard = utterance.expect === undefined ? undefined : (utterance.expect?.card ?? null)
  const gotCard = shown ? (r?.topic.id ?? null) : null
  const check = expectedCard === undefined ? undefined : expectedCard === gotCard

  return (
    <li
      className={cn(
        'flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors',
        shown ? 'bg-accent text-accent-foreground ring-1 ring-ring/40' : mentioned ? 'bg-muted/60' : 'bg-transparent',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{utterance.speaker}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {utterance.pending && <Spinner className="size-3" />}
          {shown && card && (
            <span className="rounded-md bg-background/70 px-1.5 py-0.5 font-medium text-foreground">
              {card.title} · {FACET_LABEL[r!.facet.id]}
            </span>
          )}
          {mentioned && card && <span className="rounded-md bg-background/70 px-1.5 py-0.5">wzmianka: {card.title}</span>}
          {debug && check !== undefined && r && (
            <span className={cn('font-mono', check ? 'text-primary' : 'text-destructive')} title={check ? 'zgodne z oczekiwaniem' : `oczekiwano: ${expectedCard ?? 'nic'}`}>
              {check ? '✓' : '✗'}
            </span>
          )}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{utterance.text}</p>
      {debug && r && (
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          {r.engine}
          {r.model ? ` ${r.model}` : ''} · {r.latencyMs} ms · info {r.needsInfo.toFixed(2)} · {r.topic.id ?? 'none'} {r.topic.confidence.toFixed(2)} · {r.facet.id}{' '}
          {r.facet.confidence.toFixed(2)}
          {r.error ? ` · błąd: ${r.error}` : ''}
        </p>
      )}
    </li>
  )
}
