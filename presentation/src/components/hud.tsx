import { Maximize2, Minimize2, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX } from 'lucide-react'
import type { ReactNode } from 'react'

import type { NarratorEngine, NarratorStatus } from '@/lib/narrator'

export const HUD_HEIGHT = 92

export interface HudProps {
  index: number
  total: number
  title: string
  status: NarratorStatus
  engine: NarratorEngine
  voice: string
  detail?: string
  auto: boolean
  narrating: boolean
  fullscreen: boolean
  caption: ReactNode
  onReplay: () => void
  onTogglePause: () => void
  onToggleAuto: () => void
  onToggleVoice: () => void
  onToggleFullscreen: () => void
}

const STATUS_LABEL: Record<NarratorStatus, string> = {
  idle: 'Gotowy',
  loading: 'Syntezuję…',
  speaking: 'Mówi',
  paused: 'Pauza',
  error: 'Błąd',
}

const Button = ({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={[
      'grid size-10 place-items-center rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
      active ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line bg-white/4 text-foreground/80 hover:bg-white/8',
    ].join(' ')}
  >
    {children}
  </button>
)

export const Hud = ({ index, total, title, status, engine, voice, detail, auto, narrating, fullscreen, caption, onReplay, onTogglePause, onToggleAuto, onToggleVoice, onToggleFullscreen }: HudProps) => (
  <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background/85 backdrop-blur" style={{ height: HUD_HEIGHT }}>
    <div className="absolute inset-x-0 top-0 h-px bg-white/6">
      <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${((index + 1) / total) * 100}%` }} />
    </div>
    <div className="grid h-full grid-cols-[260px_1fr_auto] items-center gap-6 px-6">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-medium tracking-tight text-muted">
          <span className="font-mono tabular-nums text-foreground">{index + 1}</span>
          <span className="mx-1">/</span>
          <span className="font-mono tabular-nums">{total}</span>
          <span className="mx-2">·</span>
          {title}
        </span>
        <span className="flex items-center gap-2 text-[12px] text-muted">
          <span className={['size-1.5 rounded-full', status === 'speaking' ? 'bg-ok' : status === 'loading' ? 'bg-warm animate-pulse' : status === 'error' ? 'bg-danger' : 'bg-muted/50'].join(' ')} />
          {narrating ? (engine === 'grok' ? `Grok Voice · ${voice}` : engine === 'browser' ? 'Głos przeglądarki' : 'Lektor') : 'Lektor wyłączony'}
          <span className="text-muted/60">· {status === 'error' && detail ? detail : STATUS_LABEL[status]}</span>
        </span>
      </div>
      <div className="min-w-0">{caption}</div>
      <div className="flex items-center gap-2">
        <Button label="Powtórz narrację (R)" onClick={onReplay}>
          <RotateCcw className="size-4" />
        </Button>
        <Button label={status === 'paused' ? 'Wznów (P)' : 'Pauza (P)'} onClick={onTogglePause}>
          {status === 'paused' ? <Play className="size-4" /> : <Pause className="size-4" />}
        </Button>
        <Button label="Automatyczne przejścia (A)" active={auto} onClick={onToggleAuto}>
          <SkipForward className="size-4" />
        </Button>
        <Button label={narrating ? 'Wyłącz lektora (V)' : 'Włącz lektora (V)'} active={narrating} onClick={onToggleVoice}>
          {narrating ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </Button>
        <Button label="Pełny ekran (F)" onClick={onToggleFullscreen}>
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
      </div>
    </div>
  </footer>
)
