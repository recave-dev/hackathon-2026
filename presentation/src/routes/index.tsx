import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { Caption } from '@/components/caption'
import { HUD_HEIGHT, Hud } from '@/components/hud'
import { DEFAULT_HOME, ORB_COLORS, OrbPointer } from '@/components/orb-pointer'
import { Stage } from '@/components/stage'
import { parseNarration } from '@/lib/narration'
import { Narrator, type NarratorEngine, type NarratorStatus } from '@/lib/narrator'
import { getTtsStatus } from '@/lib/tts-status'
import { NebulaOrb } from '@/orb/nebula-orb'
import type { OrbState } from '@/orb/orb-state'
import { SLIDES } from '@/slides/deck'
import { NARRATION } from '@/slides/narration'

interface DeckSearch {
  s: number
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): DeckSearch => {
    const n = Number(search.s)
    return { s: Number.isFinite(n) && n >= 1 && n <= SLIDES.length ? Math.floor(n) : 1 }
  },
  loader: () => getTtsStatus(),
  component: Deck,
})

/** Progress ticks many times a second; only the caption subscribes to them. */
const createProgressStore = () => {
  let value = 0
  const listeners = new Set<() => void>()
  return {
    set: (next: number) => {
      if (next === value) return
      value = next
      for (const l of listeners) l()
    },
    subscribe: (l: () => void) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    get: () => value,
  }
}

const AUTO_ADVANCE_GAP_MS = 1100

function Deck() {
  const { s } = Route.useSearch()
  const { ttsConfigured, voice } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/' })
  const index = s - 1
  const slide = SLIDES[index]!

  const [started, setStarted] = useState(false)
  const [narrating, setNarrating] = useState(true)
  const [auto, setAuto] = useState(true)
  const [status, setStatus] = useState<NarratorStatus>('idle')
  const [detail, setDetail] = useState<string | undefined>()
  const [engine, setEngine] = useState<NarratorEngine>(null)
  const [activeCue, setActiveCue] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const registry = useRef(new Map<string, HTMLElement>())
  const stageRef = useRef<HTMLDivElement | null>(null)
  const progress = useMemo(createProgressStore, [])
  const spoken = useSyncExternalStore(progress.subscribe, progress.get, () => 0)
  const autoRef = useRef(auto)
  autoRef.current = auto
  const narratingRef = useRef(narrating)
  narratingRef.current = narrating

  const narratorRef = useRef<Narrator | null>(null)
  const narrator = (): Narrator => {
    if (!narratorRef.current) {
      narratorRef.current = new Narrator({
        onStatus: (next, info) => {
          setStatus(next)
          setDetail(info)
        },
        onEngine: setEngine,
        onCue: setActiveCue,
        onProgress: progress.set,
      })
    }
    return narratorRef.current
  }

  const go = useCallback(
    (to: number) => {
      const clamped = Math.min(SLIDES.length - 1, Math.max(0, to))
      if (clamped === index) return
      void navigate({ search: { s: clamped + 1 } })
    },
    [index, navigate],
  )

  const narration = NARRATION[slide.id] ?? ''
  const captionText = useMemo(() => parseNarration(narration).text, [narration])

  // Speak the slide, then advance when autoplay is on. Any slide change stops the current clip.
  const [replay, setReplay] = useState(0)
  useEffect(() => {
    if (!started) return
    const n = narrator()
    progress.set(0)
    if (!narratingRef.current) {
      n.stop()
      return
    }
    let cancelled = false
    void n.speak(narration).then((completed) => {
      if (cancelled || !completed || !autoRef.current) return
      if (index >= SLIDES.length - 1) return
      window.setTimeout(() => {
        if (!cancelled && autoRef.current) go(index + 1)
      }, AUTO_ADVANCE_GAP_MS)
    })
    const next = SLIDES[index + 1]
    if (next) n.prefetch(NARRATION[next.id] ?? '')
    return () => {
      cancelled = true
      n.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, index, narration, replay])

  const start = (withVoice: boolean) => {
    const n = narrator()
    n.unlock()
    setNarrating(withVoice)
    narratingRef.current = withVoice
    setStarted(true)
    if (!withVoice) setAuto(false)
  }

  const toggleVoice = useCallback(() => {
    const next = !narratingRef.current
    narratingRef.current = next
    setNarrating(next)
    if (next) setReplay((r) => r + 1)
    else narrator().stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const togglePause = useCallback(() => {
    const n = narrator()
    if (status === 'paused') n.resume()
    else if (status === 'speaking') n.pause()
  }, [status])

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
      if (!started && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        start(true)
        return
      }
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'Enter':
          event.preventDefault()
          go(index + 1)
          break
        case 'ArrowLeft':
        case 'PageUp':
        case 'Backspace':
          event.preventDefault()
          go(index - 1)
          break
        case 'Home':
          go(0)
          break
        case 'End':
          go(SLIDES.length - 1)
          break
        case 'r':
        case 'R':
          setReplay((r) => r + 1)
          break
        case 'p':
        case 'P':
          togglePause()
          break
        case 'a':
        case 'A':
          setAuto((v) => !v)
          break
        case 'v':
        case 'V':
          toggleVoice()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        default:
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, index, go, togglePause, toggleVoice, toggleFullscreen])

  useEffect(() => {
    document.title = `${index + 1}/${SLIDES.length} · ${slide.title} · Droker`
  }, [index, slide.title])

  const orbState: OrbState = !started ? 'idle' : status === 'speaking' ? 'speaking' : status === 'loading' ? 'thinking' : status === 'error' ? 'error' : 'idle'
  const levelRef = narratorRef.current?.levelRef ?? { current: -1 }
  const SlideComponent = slide.Component

  return (
    <main className="relative h-screen w-screen select-none overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_700px_at_70%_-10%,oklch(0.3_0.05_250/_0.55),transparent_70%),radial-gradient(900px_600px_at_0%_100%,oklch(0.28_0.04_200/_0.45),transparent_70%)]" />

      <Stage active={activeCue} registry={registry} stageRef={stageRef} reserveBottom={HUD_HEIGHT}>
        <div key={slide.id} className="absolute inset-0">
          <SlideComponent />
        </div>
        <OrbPointer activeCue={activeCue} registry={registry} stageRef={stageRef} home={slide.orb ?? DEFAULT_HOME} state={orbState} levelRef={levelRef} />
        <div className="absolute bottom-6 left-24 font-mono text-[12px] tracking-[0.18em] text-muted/60 uppercase">Droker · Hackathon 2026 · Bielsko-Biała</div>
      </Stage>

      <Hud
        index={index}
        total={SLIDES.length}
        title={slide.title}
        status={status}
        engine={engine}
        voice={voice}
        detail={detail}
        auto={auto}
        narrating={narrating}
        fullscreen={fullscreen}
        caption={narrating ? <Caption text={captionText} spokenChars={spoken} /> : <span className="text-[14px] text-muted">Lektor wyłączony. Strzałki zmieniają slajdy, V włącza głos.</span>}
        onReplay={() => setReplay((r) => r + 1)}
        onTogglePause={togglePause}
        onToggleAuto={() => setAuto((v) => !v)}
        onToggleVoice={toggleVoice}
        onToggleFullscreen={toggleFullscreen}
      />

      {!started && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-background/80 backdrop-blur-md">
          <div className="flex w-[560px] flex-col items-center gap-8 rounded-3xl border border-line bg-surface/90 p-12 text-center shadow-2xl">
            <NebulaOrb state="idle" size={180} colorFrom={ORB_COLORS.from} colorTo={ORB_COLORS.to} label="Bolek" />
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold tracking-[0.24em] text-accent uppercase">Droker · Zanim zdecydujesz</span>
              <h1 className="m-0 text-3xl font-semibold tracking-tight">Prezentację prowadzi Bolek</h1>
              <p className="m-0 text-muted">
                {ttsConfigured
                  ? `Głos: xAI Grok Voice (${voice}). Bolek czyta każdy slajd i wskazuje, o czym mówi.`
                  : 'Brak XAI_API_KEY na serwerze. Bolek użyje głosu przeglądarki; ustaw klucz w .env, aby włączyć Grok Voice.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => start(true)}
                className="rounded-full bg-accent px-6 py-3 text-[15px] font-semibold text-background transition-transform hover:scale-[1.02] active:scale-95"
              >
                Start z lektorem
              </button>
              <button
                type="button"
                onClick={() => start(false)}
                className="rounded-full border border-line px-6 py-3 text-[15px] font-medium text-foreground/80 transition-colors hover:bg-white/6"
              >
                Bez głosu
              </button>
            </div>
            <p className="m-0 text-[12px] text-muted/70">→ dalej · ← wstecz · R powtórz · P pauza · A auto · V lektor · F pełny ekran</p>
          </div>
        </div>
      )}
    </main>
  )
}
