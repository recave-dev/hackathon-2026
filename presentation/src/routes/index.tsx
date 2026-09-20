import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Maximize2, Minimize2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Stage } from '@/components/stage'
import { SLIDES } from '@/slides/deck'

interface DeckSearch {
  s: number
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): DeckSearch => {
    const n = Number(search.s)
    return { s: Number.isFinite(n) && n >= 1 && n <= SLIDES.length ? Math.floor(n) : 1 }
  },
  component: Deck,
})

const FOOTER_HEIGHT = 72

function Deck() {
  const { s } = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const index = s - 1
  const slide = SLIDES[index]!
  const SlideComponent = slide.Component
  const [fullscreen, setFullscreen] = useState(false)
  const registry = useRef(new Map<string, HTMLElement>())
  const stageRef = useRef<HTMLDivElement | null>(null)

  const go = useCallback(
    (to: number) => {
      const next = Math.min(SLIDES.length - 1, Math.max(0, to))
      if (next !== index) void navigate({ search: { s: next + 1 } })
    },
    [index, navigate],
  )

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest('video, input, textarea, [contenteditable="true"]')) return
      const buttonFocused = event.target instanceof HTMLElement && Boolean(event.target.closest('button'))
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
          event.preventDefault()
          go(index + 1)
          break
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault()
          go(index - 1)
          break
        case ' ':
          if (!buttonFocused && slide.kind !== 'video') {
            event.preventDefault()
            go(index + 1)
          }
          break
        case 'Home':
          event.preventDefault()
          go(0)
          break
        case 'End':
          event.preventDefault()
          go(SLIDES.length - 1)
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index, slide.kind, toggleFullscreen])

  useEffect(() => {
    document.title = `${index + 1}/${SLIDES.length} · ${slide.title} · Droker`
  }, [index, slide.title])

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_700px_at_85%_0%,oklch(0.23_0.035_245/_0.45),transparent_70%)]" />

      <Stage active={null} registry={registry} stageRef={stageRef} reserveBottom={FOOTER_HEIGHT}>
        <div key={slide.id} className="absolute inset-0">
          <SlideComponent />
        </div>
      </Stage>

      <footer className="absolute inset-x-0 bottom-0 flex h-[72px] items-center justify-between border-t border-line bg-background/95 px-8">
        <div className="flex items-center gap-5">
          <span className="font-mono text-[14px] tabular-nums text-muted">{String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</span>
          <span className="text-[15px] font-medium text-foreground/85">{slide.title}</span>
        </div>
        <div className="flex items-center gap-2" aria-label="Nawigacja slajdów">
          {SLIDES.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Slajd ${i + 1}: ${item.title}`}
              aria-current={i === index ? 'step' : undefined}
              className={`h-1.5 w-7 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${i === index ? 'bg-accent' : 'bg-white/20 hover:bg-white/45'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Poprzedni slajd" className="deck-control">
            <ArrowLeft size={20} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={() => go(index + 1)} disabled={index === SLIDES.length - 1} aria-label="Następny slajd" className="deck-control">
            <ArrowRight size={20} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Wyłącz pełny ekran' : 'Pełny ekran'} className="deck-control">
            {fullscreen ? <Minimize2 size={20} strokeWidth={1.8} /> : <Maximize2 size={20} strokeWidth={1.8} />}
          </button>
        </div>
      </footer>
    </main>
  )
}
