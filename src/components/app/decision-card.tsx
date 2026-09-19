import { useNavigate } from '@tanstack/react-router'
import { CircleDashedIcon, ClockIcon, FilesIcon, LayersIcon, ListTreeIcon } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'

import { SnoozeDialog } from '@/components/app/decision-dialogs'
import { Button } from '@/components/ui/button'
import { formatDue, isOverdue } from '@/demo/format'
import { STATUS_LABEL, personName, projectLabel } from '@/demo/selectors'
import { useDemoState } from '@/demo/store'
import type { Decision } from '@/demo/types'
import { cn } from '@/lib/utils'

const SWIPE_PX = 64

type Gesture = 'left' | 'right' | 'up' | null

/**
 * Swipe: left = snooze, right = decision options, up = context and sources.
 * Gestures only open things; nothing is approved or executed from a gesture.
 * Every gesture has a button twin in the card footer.
 */
export function DecisionCard({ decision }: { decision: Decision }) {
  const state = useDemoState()
  const navigate = useNavigate()
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const swiped = useRef(false)

  const actionable = decision.status === 'pending' || decision.status === 'snoozed'
  const sourcesCount = decision.sourceIds.length
  const overdue = decision.status === 'pending' && isOverdue(decision.dueAt, state.now)

  const open = (section?: 'options' | 'context') =>
    navigate({ to: '/app/decisions/$decisionId', params: { decisionId: decision.id }, search: section ? { section } : {} })

  const finish = (gesture: Gesture) => {
    setOffset({ x: 0, y: 0 })
    if (!gesture) return
    swiped.current = true
    if (gesture === 'left' && actionable) setSnoozeOpen(true)
    if (gesture === 'right') void open('options')
    if (gesture === 'up') void open('context')
  }

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    swiped.current = false
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    if (Math.abs(dx) > 8 || dy < -8) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Synthetic or already-released pointers cannot be captured; the swipe still works.
      }
      setOffset({ x: Math.max(-96, Math.min(96, dx)), y: Math.min(0, Math.max(-64, dy)) })
    }
  }
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    start.current = null
    let gesture: Gesture = null
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) gesture = dx < 0 ? 'left' : 'right'
    else if (dy <= -SWIPE_PX) gesture = 'up'
    finish(gesture)
  }
  const onPointerCancel = () => {
    start.current = null
    setOffset({ x: 0, y: 0 })
  }

  const hint = offset.x <= -32 ? 'Odłóż' : offset.x >= 32 ? 'Opcje decyzji' : offset.y <= -32 ? 'Kontekst i źródła' : null

  return (
    <article className="relative">
      {hint && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-5 text-center text-[11px] font-medium text-muted-foreground">
          {hint}
        </span>
      )}
      <div
        className="rounded-2xl border border-border bg-card transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none [touch-action:pan-y]"
        style={{ transform: offset.x || offset.y ? `translate(${offset.x}px, ${offset.y}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <button
          type="button"
          onClick={() => {
            if (swiped.current) return
            void open()
          }}
          className="flex w-full flex-col gap-2.5 rounded-t-2xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`Otwórz sprawę: ${decision.title}`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">{projectLabel(state, decision.projectId)}</p>
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                decision.status === 'pending' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {decision.status === 'delegated' ? `Delegowano: ${personName(state, decision.delegatedToId).split(' ')[0]}` : STATUS_LABEL[decision.status]}
            </span>
          </div>
          <h3 className="text-base leading-snug font-semibold tracking-tight text-balance">{decision.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{decision.why}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-muted-foreground">
            <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}>
              <ClockIcon className="size-3.5" />
              {decision.status === 'snoozed' && decision.snoozedUntil
                ? `wraca ${formatDue(decision.snoozedUntil, state.now)}`
                : decision.status === 'pending'
                  ? `reakcja do ${formatDue(decision.dueAt, state.now)}`
                  : decision.decidedAt
                    ? `zdecydowano ${formatDue(decision.decidedAt, state.now)}`
                    : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <FilesIcon className="size-3.5" />
              {sourcesCount} {sourcesCount === 1 ? 'źródło' : sourcesCount < 5 ? 'źródła' : 'źródeł'}
            </span>
            {decision.execution.some((s) => s.status === 'waiting') && (
              <span className="inline-flex items-center gap-1 text-primary">
                <CircleDashedIcon className="size-3.5" /> realizacja w toku
              </span>
            )}
          </div>
        </button>
        {actionable && (
          <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSnoozeOpen(true)}>
              <ClockIcon /> Odłóż
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void open('context')}>
              <LayersIcon /> Kontekst
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void open('options')}>
              <ListTreeIcon /> Opcje
            </Button>
          </div>
        )}
      </div>
      {actionable && <SnoozeDialog decision={decision} open={snoozeOpen} onOpenChange={setSnoozeOpen} />}
    </article>
  )
}
