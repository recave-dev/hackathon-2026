import { parseNarration, type NarrationCue, type ParsedNarration } from './narration'
import type { SpeechClip } from './tts-server'

/**
 * Plays slide narration and turns it into three signals the stage consumes:
 *  - `levelRef`: 0..1 loudness of the voice, sampled every frame from an
 *    AnalyserNode on the audio output, so the orb "moves as it speaks";
 *  - cues: `{{id}}` markers mapped onto Grok's character timestamps, fired
 *    when the voice reaches that word, so the orb can point at slide elements;
 *  - progress: how many characters have been spoken, for the karaoke caption.
 *
 * Audio comes from `/api/tts` (xAI Grok Voice, proxied server-side). When the
 * server has no key or is unreachable the narrator falls back to the browser's
 * own speechSynthesis with the same cue and progress events, so the deck still
 * runs, just with a local voice.
 */

export type NarratorStatus = 'idle' | 'loading' | 'speaking' | 'paused' | 'error'
export type NarratorEngine = 'grok' | 'browser' | null

export interface NarratorEvents {
  onStatus: (status: NarratorStatus, detail?: string) => void
  onEngine: (engine: NarratorEngine) => void
  onCue: (id: string | null) => void
  onProgress: (spokenChars: number) => void
}

type ClipResponse = Omit<SpeechClip, 'cached'> & { cached?: boolean }

interface TimedCue extends NarrationCue {
  at: number
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/** Start time of the first spoken (non-space) character at or after `offset`. */
const cueTime = (clip: ClipResponse, offset: number, textLength: number): number => {
  const { chars, times, duration } = clip
  if (chars.length && times.length === chars.length) {
    for (let i = Math.min(offset, chars.length - 1); i < chars.length; i++) {
      if (chars[i]!.trim() && times[i]) return times[i]![0]
    }
    return duration
  }
  return textLength ? (offset / textLength) * duration : 0
}

export class Narrator {
  readonly levelRef: { current: number } = { current: -1 }
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private audio: HTMLAudioElement | null = null
  private raf = 0
  private clips = new Map<string, Promise<ClipResponse>>()
  private serverOk: boolean | null = null
  private token = 0
  private utterance: SpeechSynthesisUtterance | null = null
  private status: NarratorStatus = 'idle'
  volume = 1

  constructor(private readonly events: NarratorEvents) {}

  /** Must run inside a user gesture so the browser lets audio play. */
  unlock(): void {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.analyser = this.ctx.createAnalyser()
      this.analyser.fftSize = 1024
      this.analyser.smoothingTimeConstant = 0.6
      this.audio = new Audio()
      this.audio.preload = 'auto'
      this.audio.crossOrigin = 'anonymous'
      const source = this.ctx.createMediaElementSource(this.audio)
      source.connect(this.analyser)
      this.analyser.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    // Priming speechSynthesis inside the gesture makes later fallbacks audible.
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices()
  }

  get unlocked(): boolean {
    return this.ctx !== null
  }

  /** Warms the server cache and the in-memory cache without playing. */
  prefetch(raw: string): void {
    if (this.serverOk === false) return
    const { text } = parseNarration(raw)
    void this.fetchClip(text).catch(() => {})
  }

  private fetchClip(text: string): Promise<ClipResponse> {
    const hit = this.clips.get(text)
    if (hit) return hit
    const request = (async () => {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: string }
        if (response.status === 503) this.serverOk = false
        throw new Error(detail.error ?? `TTS ${response.status}`)
      }
      this.serverOk = true
      return (await response.json()) as ClipResponse
    })()
    this.clips.set(text, request)
    request.catch(() => this.clips.delete(text))
    return request
  }

  /** Speaks one narration; resolves `true` when it played to the end, `false` when interrupted. */
  async speak(raw: string): Promise<boolean> {
    this.stop()
    const token = ++this.token
    const parsed = parseNarration(raw)
    if (!parsed.text) return true
    this.setStatus('loading')

    let clip: ClipResponse | null = null
    if (this.serverOk !== false) {
      try {
        clip = await this.fetchClip(parsed.text)
      } catch (error) {
        console.warn('narrator: falling back to browser speech', error)
      }
    }
    if (token !== this.token) return false

    let completed = false
    if (clip && this.audio && this.ctx) {
      this.events.onEngine('grok')
      completed = await this.playClip(clip, parsed, token)
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.events.onEngine('browser')
      completed = await this.speakWithBrowser(parsed, token)
    } else {
      this.setStatus('error', 'Brak silnika mowy w tej przeglądarce.')
    }
    if (token === this.token) {
      this.events.onCue(null)
      this.levelRef.current = -1
      this.setStatus('idle')
      return completed
    }
    return false
  }

  private playClip(clip: ClipResponse, parsed: ParsedNarration, token: number): Promise<boolean> {
    const audio = this.audio!
    const blob = base64ToBlob(clip.audio, clip.contentType)
    const url = URL.createObjectURL(blob)
    const cues: TimedCue[] = parsed.cues.map((c) => ({ ...c, at: cueTime(clip, c.offset, parsed.text.length) }))
    const starts = clip.times.length === clip.chars.length ? clip.times.map((t) => t[0]) : null

    return new Promise<boolean>((resolve) => {
      let fired = -1
      let spoken = 0
      const finish = (completed: boolean) => {
        cancelAnimationFrame(this.raf)
        this.raf = 0
        audio.onended = null
        audio.onerror = null
        URL.revokeObjectURL(url)
        resolve(completed)
      }
      const tick = () => {
        if (token !== this.token) return finish(false)
        const t = audio.currentTime
        this.sampleLevel()
        // Fire the latest cue whose time has come; skipping ahead is fine when seeking.
        let next = fired
        while (next + 1 < cues.length && cues[next + 1]!.at <= t + 0.05) next++
        if (next !== fired) {
          fired = next
          this.events.onCue(cues[fired]!.id)
        }
        const progressed = starts ? countSpoken(starts, t, spoken) : Math.round((t / (clip.duration || 1)) * parsed.text.length)
        if (progressed !== spoken) {
          spoken = progressed
          this.events.onProgress(spoken)
        }
        this.raf = requestAnimationFrame(tick)
      }
      audio.onended = () => {
        this.events.onProgress(parsed.text.length)
        finish(true)
      }
      audio.onerror = () => {
        this.setStatus('error', 'Nie udało się odtworzyć nagrania.')
        finish(false)
      }
      audio.src = url
      audio.volume = this.volume
      void audio.play().then(
        () => {
          this.setStatus('speaking')
          this.raf = requestAnimationFrame(tick)
        },
        (error: unknown) => {
          this.setStatus('error', error instanceof Error ? error.message : 'Autoplay zablokowany.')
          finish(false)
        },
      )
    })
  }

  private speakWithBrowser(parsed: ParsedNarration, token: number): Promise<boolean> {
    const synth = window.speechSynthesis
    return new Promise<boolean>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(parsed.text.replace(/\[[a-z-]+\]/g, ''))
      utterance.lang = 'pl-PL'
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('pl'))
      if (voice) utterance.voice = voice
      utterance.rate = 1
      utterance.volume = this.volume
      let fired = -1
      utterance.onstart = () => {
        this.setStatus('speaking')
        // No analyser on speechSynthesis output; the orb animates its own speaking energy.
        this.levelRef.current = -1
      }
      utterance.onboundary = (event) => {
        if (token !== this.token) return
        const index = event.charIndex + (event.charLength ?? 0)
        this.events.onProgress(index)
        let next = fired
        while (next + 1 < parsed.cues.length && parsed.cues[next + 1]!.offset <= index) next++
        if (next !== fired) {
          fired = next
          this.events.onCue(parsed.cues[fired]!.id)
        }
      }
      const done = (completed: boolean) => {
        if (this.utterance === utterance) this.utterance = null
        if (completed) this.events.onProgress(parsed.text.length)
        resolve(completed && token === this.token)
      }
      utterance.onend = () => done(true)
      utterance.onerror = (event) => {
        if (event.error !== 'interrupted' && event.error !== 'canceled') this.setStatus('error', `Mowa: ${event.error}`)
        done(false)
      }
      this.utterance = utterance
      synth.cancel()
      synth.speak(utterance)
    })
  }

  pause(): void {
    if (this.status !== 'speaking') return
    this.audio?.pause()
    if (this.utterance) window.speechSynthesis.pause()
    this.setStatus('paused')
  }

  resume(): void {
    if (this.status !== 'paused') return
    if (this.utterance) window.speechSynthesis.resume()
    else void this.audio?.play()
    this.setStatus('speaking')
  }

  stop(): void {
    this.token++
    cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this.audio) {
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
    }
    if (this.utterance && typeof window !== 'undefined') {
      this.utterance = null
      window.speechSynthesis.cancel()
    }
    this.levelRef.current = -1
    this.events.onCue(null)
    if (this.status !== 'idle') this.setStatus('idle')
  }

  setVolume(volume: number): void {
    this.volume = clamp01(volume)
    if (this.audio) this.audio.volume = this.volume
  }

  private setStatus(status: NarratorStatus, detail?: string): void {
    this.status = status
    this.events.onStatus(status, detail)
  }

  private sampleLevel(): void {
    const analyser = this.analyser
    if (!analyser) return
    const data = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!
    const rms = Math.sqrt(sum / data.length)
    // Speech RMS sits around 0.03–0.2; map that onto the orb's 0..1 range.
    const target = clamp01((rms - 0.015) / 0.18)
    const prev = this.levelRef.current < 0 ? target : this.levelRef.current
    this.levelRef.current = prev + (target - prev) * 0.35
  }
}

/** Index of the first character whose start time is still ahead of `t`, resuming from `from`. */
const countSpoken = (starts: number[], t: number, from: number): number => {
  let i = from
  while (i < starts.length && starts[i]! <= t) i++
  return i
}

const base64ToBlob = (base64: string, type: string): Blob => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}
