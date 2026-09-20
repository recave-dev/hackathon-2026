import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

import { NebulaOrb } from '@/orb/nebula-orb'
import type { OrbState } from '@/orb/orb-state'
import { STAGE_H, STAGE_W } from './stage'

export const ORB_COLORS = { from: '#9db0ea', to: '#bfe6e6' } as const

export interface OrbHome {
  x: number
  y: number
  size: number
}

/** Content slides keep the top-right corner free: the orb hovers beside the title. */
export const DEFAULT_HOME: OrbHome = { x: STAGE_W - 96 - 150, y: 56, size: 150 }
/** Title and closing slides: a large orb above the centred text block. */
export const CENTER_HOME: OrbHome = { x: STAGE_W / 2 - 170, y: 110, size: 340 }

const POINT_SIZE = 104
const GAP = 24
const MARGIN = 20

interface Placement extends OrbHome {
  pointing: boolean
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

const overlap = (a: Box, b: Box): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/** Element rect in stage (design pixel) coordinates. */
const stageBox = (el: Element, stage: DOMRect, scale: number): Box => {
  const r = el.getBoundingClientRect()
  return { x: (r.left - stage.left) / scale, y: (r.top - stage.top) / scale, w: r.width / scale, h: r.height / scale }
}

/**
 * Where the orb should sit to point at `el`. Tries beside the element (left,
 * right), then above and below, and takes the first spot inside the stage
 * that does not cover another cue or the slide header; otherwise the spot
 * that covers the least.
 */
const placeBeside = (el: HTMLElement, stage: HTMLElement): Placement => {
  const s = stage.getBoundingClientRect()
  const scale = s.width / STAGE_W || 1
  const target = stageBox(el, s, scale)
  const obstacles = Array.from(stage.querySelectorAll<HTMLElement>('[data-cue], [data-obstacle]'))
    .filter((node) => node !== el && !el.contains(node) && !node.contains(el))
    .map((node) => stageBox(node, s, scale))

  const size = POINT_SIZE
  const midX = target.x + target.w / 2 - size / 2
  const midY = target.y + target.h / 2 - size / 2
  const candidates: Box[] = [
    { x: target.x - size - GAP, y: midY, w: size, h: size },
    { x: target.x + target.w + GAP, y: midY, w: size, h: size },
    { x: midX, y: target.y - size - GAP, w: size, h: size },
    { x: midX, y: target.y + target.h + GAP, w: size, h: size },
    // Last resort: tuck into the element's top-right corner, half outside (icons sit top-left).
    { x: target.x + target.w - size / 2, y: target.y - size / 2, w: size, h: size },
  ]

  let best: Box | null = null
  let bestCost = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    const inside = c.x >= MARGIN && c.y >= MARGIN && c.x + c.w <= STAGE_W - MARGIN && c.y + c.h <= STAGE_H - MARGIN
    if (!inside) continue
    const cost = obstacles.reduce((sum, o) => sum + overlap(c, o), 0)
    if (cost === 0) return { x: c.x, y: c.y, size, pointing: true }
    if (cost < bestCost) {
      bestCost = cost
      best = c
    }
  }
  const fallback = best ?? candidates[4]!
  return {
    x: clamp(fallback.x, MARGIN, STAGE_W - MARGIN - size),
    y: clamp(fallback.y, MARGIN, STAGE_H - MARGIN - size),
    size,
    pointing: true,
  }
}

export interface OrbPointerProps {
  activeCue: string | null
  registry: RefObject<Map<string, HTMLElement>>
  stageRef: RefObject<HTMLDivElement | null>
  home: OrbHome
  state: OrbState
  levelRef: RefObject<number>
}

/**
 * The narrator's body on stage. Rests at the slide's home spot and glides next
 * to whatever element the narration is currently talking about.
 */
export const OrbPointer = ({ activeCue, registry, stageRef, home, state, levelRef }: OrbPointerProps) => {
  const [placement, setPlacement] = useState<Placement>({ ...home, pointing: false })

  useLayoutEffect(() => {
    const compute = () => {
      const stage = stageRef.current
      const el = activeCue ? registry.current.get(activeCue) : undefined
      if (!stage || !el) {
        setPlacement({ ...home, pointing: false })
        return
      }
      setPlacement(placeBeside(el, stage))
    }
    compute()
    // Slide content animates in for ~600 ms; re-measure once it has settled.
    const timer = window.setTimeout(compute, 650)
    window.addEventListener('resize', compute)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', compute)
    }
  }, [activeCue, home, registry, stageRef])

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{
        width: placement.size,
        height: placement.size,
        transform: `translate(${placement.x}px, ${placement.y}px)`,
        transition: 'transform 750ms cubic-bezier(0.2, 0.8, 0.2, 1), width 600ms cubic-bezier(0.2, 0.8, 0.2, 1), height 600ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      {placement.pointing && state === 'speaking' && (
        <div className="orb-ring absolute inset-[6%] rounded-full border border-accent/50" />
      )}
      <NebulaOrb state={state} size={placement.size} colorFrom={ORB_COLORS.from} colorTo={ORB_COLORS.to} levelRef={levelRef} label="Bolek" />
    </div>
  )
}
