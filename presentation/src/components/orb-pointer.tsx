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
export const CENTER_HOME: OrbHome = { x: STAGE_W / 2 - 170, y: 250, size: 340 }

const POINT_SIZE = 116
const GAP = 28
const MARGIN = 24

interface Placement extends OrbHome {
  pointing: boolean
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Where the orb should sit to point at `el`: to its left, or to its right when there is no room. */
const placeBeside = (el: HTMLElement, stage: HTMLElement): Placement => {
  const s = stage.getBoundingClientRect()
  const scale = s.width / STAGE_W || 1
  const r = el.getBoundingClientRect()
  const left = (r.left - s.left) / scale
  const top = (r.top - s.top) / scale
  const width = r.width / scale
  const height = r.height / scale
  let x = left - POINT_SIZE - GAP
  if (x < MARGIN) x = left + width + GAP
  if (x + POINT_SIZE > STAGE_W - MARGIN) x = clamp(left + width / 2 - POINT_SIZE / 2, MARGIN, STAGE_W - MARGIN - POINT_SIZE)
  const y = clamp(top + height / 2 - POINT_SIZE / 2, MARGIN, STAGE_H - MARGIN - POINT_SIZE)
  return { x, y, size: POINT_SIZE, pointing: true }
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
