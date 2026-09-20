import { createContext, createElement, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'

/** Slides are laid out on a fixed 16:9 canvas and scaled to the viewport. */
export const STAGE_W = 1600
export const STAGE_H = 900

interface CueRegistry {
  active: string | null
  register: (id: string, el: HTMLElement | null) => void
}

const CueContext = createContext<CueRegistry>({ active: null, register: () => {} })

export interface StageProps {
  active: string | null
  registry: RefObject<Map<string, HTMLElement>>
  stageRef: RefObject<HTMLDivElement | null>
  /** Viewport height reserved for chrome under the stage (caption bar). */
  reserveBottom?: number
  children: ReactNode
}

export const Stage = ({ active, registry, stageRef, reserveBottom = 0, children }: StageProps) => {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const fit = () => {
      const w = window.innerWidth
      const h = window.innerHeight - reserveBottom
      setScale(Math.min(w / STAGE_W, h / STAGE_H))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [reserveBottom])

  const register = useCallback(
    (id: string, el: HTMLElement | null) => {
      if (el) registry.current.set(id, el)
      else registry.current.delete(id)
    },
    [registry],
  )
  const value = useMemo(() => ({ active, register }), [active, register])

  return (
    <CueContext.Provider value={value}>
      <div className="relative flex w-full items-center justify-center" style={{ height: `calc(100vh - ${reserveBottom}px)` }}>
        <div
          ref={stageRef}
          data-has-active-cue={active ? 'true' : 'false'}
          className="relative overflow-hidden"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'center center', flex: 'none' }}
        >
          {children}
        </div>
      </div>
    </CueContext.Provider>
  )
}

export interface CueProps {
  id: string
  as?: 'div' | 'section' | 'li' | 'span'
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/** Anything the narration can point at. Highlights itself while its cue is active. */
export const Cue = ({ id, as = 'div', className, style, children }: CueProps) => {
  const { active, register } = useContext(CueContext)
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    register(id, ref.current)
    return () => register(id, null)
  }, [id, register])
  return createElement(
    as,
    {
      ref,
      className: ['cue', className].filter(Boolean).join(' '),
      style,
      'data-cue': id,
      'data-cue-active': active === id ? 'true' : 'false',
    },
    children,
  )
}

export const useActiveCue = (): string | null => useContext(CueContext).active
