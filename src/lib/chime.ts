/**
 * Short synthesised chimes for the meeting screen. Bolek never speaks; a
 * sound confirms that something happened: a card landed, a result is ready,
 * the screen was cleared. WebAudio only, no assets. Browsers require a user
 * gesture before audio plays, so `installChimeUnlock` resumes the context on
 * the first click or key press.
 */

export type ChimeKind = 'done' | 'soft' | 'error'

interface Pattern {
  notes: number[]
  gap: number
  decay: number
  gain: number
  wave: OscillatorType
}

const PATTERNS: Record<ChimeKind, Pattern> = {
  /** A5 → D6: a rising fourth, "here it is". */
  done: { notes: [880, 1174.66], gap: 0.1, decay: 0.5, gain: 0.14, wave: 'sine' },
  /** E5 alone: "understood", for hiding, leaving, sending. */
  soft: { notes: [659.25], gap: 0, decay: 0.32, gain: 0.09, wave: 'sine' },
  /** C5 → G4: falling, "that did not work". */
  error: { notes: [523.25, 392], gap: 0.13, decay: 0.38, gain: 0.1, wave: 'triangle' },
}

let ctx: AudioContext | null = null
let unlocked = false

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

/** Call once on mount: resumes audio on the first gesture so later chimes are allowed to play. */
export function installChimeUnlock(): () => void {
  if (typeof window === 'undefined') return () => {}
  const resume = () => {
    const c = context()
    if (c && c.state === 'suspended') void c.resume()
    unlocked = true
  }
  window.addEventListener('pointerdown', resume, { passive: true })
  window.addEventListener('keydown', resume)
  return () => {
    window.removeEventListener('pointerdown', resume)
    window.removeEventListener('keydown', resume)
  }
}

export function playChime(kind: ChimeKind): void {
  const c = context()
  if (!c) return
  if (c.state === 'suspended') {
    if (!unlocked) return
    void c.resume()
  }
  const p = PATTERNS[kind]
  const t0 = c.currentTime + 0.01
  const master = c.createGain()
  master.gain.value = p.gain
  const warmth = c.createBiquadFilter()
  warmth.type = 'lowpass'
  warmth.frequency.value = 3800
  master.connect(warmth)
  warmth.connect(c.destination)

  p.notes.forEach((freq, i) => {
    const t = t0 + i * p.gap
    const voice = (multiple: number, level: number, decay: number, wave: OscillatorType) => {
      const osc = c.createOscillator()
      osc.type = wave
      osc.frequency.value = freq * multiple
      const g = c.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(level, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.001, t + decay)
      osc.connect(g)
      g.connect(master)
      osc.start(t)
      osc.stop(t + decay + 0.05)
    }
    voice(1, 1, p.decay, p.wave)
    // A quiet octave above gives the bell its sparkle.
    voice(2, 0.22, p.decay * 0.7, 'sine')
  })
}
