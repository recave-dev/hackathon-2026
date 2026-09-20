import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** Below this the text is too small for a TV; the page scrolls inside instead. */
const MIN_SCALE = 0.55

/**
 * Shrinks its content so it fits the height it was given. Nobody touches the
 * computer during a meeting, so a long answer scales down rather than needing
 * a scroll. Transforms do not change layout size, so the natural height stays
 * measurable and the scale converges in one step.
 */
export function FitToScreen({ children, className }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const measure = () => {
      const available = o.clientHeight
      const needed = i.scrollHeight
      if (!available || !needed) return
      setScale(needed > available ? Math.max(MIN_SCALE, available / needed) : 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={outer} className={cn('h-full min-h-0', scale <= MIN_SCALE ? 'overflow-y-auto' : 'overflow-hidden', className)}>
      <div ref={inner} style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }} className="transition-transform duration-300">
        {children}
      </div>
    </div>
  )
}
