/**
 * Browser client for xAI's speech-to-speech realtime API over WebSocket.
 * Mic audio goes up as 24 kHz PCM16 in base64 JSON frames; model audio comes
 * back the same way and is scheduled gaplessly on a Web Audio graph. The class
 * is framework-free; `use-grok-voice.ts` adapts it to React.
 */

export type VoicePhase = 'off' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

export interface VoiceTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface VoiceSessionOptions {
  model?: string
  voice?: string
  instructions: string
  tools?: VoiceTool[]
  /** Domain words that bias speech recognition (names, products). Max 100. */
  keyterms?: string[]
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown> | unknown
  onPhase?: (phase: VoicePhase) => void
  /** Live transcript of what the model is saying (accumulated per response). */
  onAgentTranscript?: (text: string) => void
  /** Live transcript of what the user said; `final` marks the completed utterance. */
  onUserTranscript?: (text: string, final: boolean) => void
  /** Current output loudness in 0..1, roughly 60 times a second. */
  onLevel?: (level: number) => void
  onError?: (message: string) => void
}

const REALTIME_URL = 'wss://api.x.ai/v1/realtime'
const DEFAULT_MODEL = 'grok-voice-latest'
const SAMPLE_RATE = 24_000
/** Send mic audio in ~100 ms frames: fewer messages than per-render-quantum. */
const FRAME_SAMPLES = 2_400

const CAPTURE_WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel) this.port.postMessage(channel.slice(0))
    return true
  }
}
registerProcessor('pcm-capture', PcmCapture)
`

export class GrokVoiceSession {
  private ws: WebSocket | null = null
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private capture: AudioWorkletNode | null = null
  private outGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private analyserBuf: Float32Array<ArrayBuffer> | null = null
  private playing = new Set<AudioBufferSourceNode>()
  private nextPlayAt = 0
  private pending: Float32Array[] = []
  private pendingSamples = 0
  private raf = 0
  private agentText = ''
  private _phase: VoicePhase = 'off'
  private responding = false
  private closed = false

  constructor(private readonly opts: VoiceSessionOptions) {}

  get phase(): VoicePhase {
    return this._phase
  }

  async start(token: string): Promise<void> {
    this.closed = false
    this.setPhase('connecting')
    try {
      await this.openAudio()
      await this.openSocket(token)
      this.loop()
    } catch (err) {
      this.fail(err instanceof Error ? err.message : String(err))
      throw err
    }
  }

  stop(): void {
    this.closed = true
    cancelAnimationFrame(this.raf)
    this.stopPlayback()
    this.ws?.close()
    this.ws = null
    this.capture?.port.close()
    this.capture?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.capture = null
    this.source = null
    this.stream = null
    this.ctx = null
    this.opts.onLevel?.(-1)
    this.setPhase('off')
  }

  /** Text side channel, useful for debugging without a mic. */
  say(text: string): void {
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    })
    this.send({ type: 'response.create' })
  }

  // --- audio -----------------------------------------------------------------

  private async openAudio(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    this.ctx = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'application/javascript' }))
    try {
      await ctx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }

    this.source = ctx.createMediaStreamSource(this.stream)
    this.capture = new AudioWorkletNode(ctx, 'pcm-capture', { numberOfInputs: 1, numberOfOutputs: 0 })
    this.capture.port.onmessage = (e: MessageEvent<Float32Array>) => this.onMicFrame(e.data)
    this.source.connect(this.capture)

    this.outGain = ctx.createGain()
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyserBuf = new Float32Array(this.analyser.fftSize)
    this.outGain.connect(this.analyser)
    this.analyser.connect(ctx.destination)
    this.nextPlayAt = ctx.currentTime
  }

  private onMicFrame(frame: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const ctxRate = this.ctx?.sampleRate ?? SAMPLE_RATE
    const samples = ctxRate === SAMPLE_RATE ? frame : resample(frame, ctxRate, SAMPLE_RATE)
    this.pending.push(samples)
    this.pendingSamples += samples.length
    if (this.pendingSamples < FRAME_SAMPLES) return

    const merged = new Float32Array(this.pendingSamples)
    let offset = 0
    for (const chunk of this.pending) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    this.pending = []
    this.pendingSamples = 0
    this.send({ type: 'input_audio_buffer.append', audio: encodePcm16(merged) })
  }

  private enqueueAudio(b64: string): void {
    const ctx = this.ctx
    if (!ctx || !this.outGain) return
    const pcm = decodePcm16(b64)
    if (pcm.length === 0) return
    const buffer = ctx.createBuffer(1, pcm.length, SAMPLE_RATE)
    buffer.copyToChannel(pcm, 0)
    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.connect(this.outGain)
    const startAt = Math.max(ctx.currentTime + 0.02, this.nextPlayAt)
    node.start(startAt)
    this.nextPlayAt = startAt + buffer.duration
    this.playing.add(node)
    node.onended = () => this.playing.delete(node)
    this.setPhase('speaking')
  }

  private stopPlayback(): void {
    for (const node of this.playing) {
      try {
        node.stop()
      } catch {
        // Already finished.
      }
    }
    this.playing.clear()
    if (this.ctx) this.nextPlayAt = this.ctx.currentTime
  }

  /** Per-frame: report output loudness and notice when playback drained. */
  private loop = (): void => {
    if (this.closed) return
    const ctx = this.ctx
    if (ctx && this.analyser && this.analyserBuf) {
      this.analyser.getFloatTimeDomainData(this.analyserBuf)
      let sum = 0
      for (let i = 0; i < this.analyserBuf.length; i++) sum += this.analyserBuf[i]! ** 2
      const rms = Math.sqrt(sum / this.analyserBuf.length)
      if (this._phase === 'speaking') this.opts.onLevel?.(Math.min(1.1, 0.3 + rms * 3.2))
      else this.opts.onLevel?.(-1)

      if (this._phase === 'speaking' && ctx.currentTime >= this.nextPlayAt && this.playing.size === 0 && !this.responding) {
        this.setPhase('listening')
      }
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  // --- socket ----------------------------------------------------------------

  private openSocket(token: string): Promise<void> {
    const model = this.opts.model ?? DEFAULT_MODEL
    const ws = new WebSocket(`${REALTIME_URL}?model=${encodeURIComponent(model)}`, [`xai-client-secret.${token}`])
    this.ws = ws
    return new Promise((resolve, reject) => {
      let settled = false
      ws.onopen = () => {
        this.send({
          type: 'session.update',
          session: {
            instructions: this.opts.instructions,
            voice: this.opts.voice ?? 'eve',
            turn_detection: { type: 'server_vad' },
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: SAMPLE_RATE },
                transport: 'json',
                ...(this.opts.keyterms?.length ? { transcription: { keyterms: this.opts.keyterms.slice(0, 100) } } : {}),
              },
              output: { format: { type: 'audio/pcm', rate: SAMPLE_RATE }, transport: 'json' },
            },
            tools: (this.opts.tools ?? []).map((t) => ({ type: 'function', ...t })),
          },
        })
      }
      ws.onmessage = (e) => {
        let event: RealtimeEvent
        try {
          event = JSON.parse(String(e.data)) as RealtimeEvent
        } catch {
          return
        }
        if (event.type === 'session.updated' && !settled) {
          settled = true
          this.setPhase('listening')
          resolve()
        }
        void this.handle(event)
      }
      ws.onerror = () => {
        if (!settled) {
          settled = true
          reject(new Error('Nie udało się połączyć z xAI'))
        }
      }
      ws.onclose = (e) => {
        if (!settled) {
          settled = true
          reject(new Error(e.reason || `Połączenie zamknięte (${e.code})`))
          return
        }
        if (!this.closed) this.fail(e.reason || 'Połączenie z agentem zostało przerwane')
      }
    })
  }

  private async handle(event: RealtimeEvent): Promise<void> {
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        this.bargeIn()
        break
      case 'conversation.item.input_audio_transcription.updated': {
        const text = transcriptOf(event)
        if (text) {
          if (this._phase === 'speaking') this.bargeIn()
          this.opts.onUserTranscript?.(text, false)
        }
        break
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const text = transcriptOf(event)
        if (text) this.opts.onUserTranscript?.(text, true)
        break
      }
      case 'response.created':
        this.responding = true
        this.agentText = ''
        this.opts.onAgentTranscript?.('')
        this.setPhase('thinking')
        break
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        if (typeof event.delta === 'string') this.enqueueAudio(event.delta)
        break
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        if (typeof event.delta === 'string') {
          this.agentText += event.delta
          this.opts.onAgentTranscript?.(this.agentText)
        }
        break
      case 'response.function_call_arguments.done':
        await this.runTool(event)
        break
      case 'response.done':
        this.responding = false
        if (this._phase === 'thinking') this.setPhase('listening')
        break
      case 'error': {
        const msg = (event.error as { message?: string } | undefined)?.message ?? 'Błąd agenta'
        console.error('[grok-voice]', event)
        this.opts.onError?.(msg)
        break
      }
    }
  }

  private async runTool(event: RealtimeEvent): Promise<void> {
    const name = String(event.name ?? '')
    const callId = String(event.call_id ?? '')
    let args: Record<string, unknown> = {}
    try {
      args = event.arguments ? (JSON.parse(String(event.arguments)) as Record<string, unknown>) : {}
    } catch {
      // Leave args empty; the tool reports the problem back to the model.
    }
    let output: unknown
    try {
      output = (await this.opts.onToolCall?.(name, args)) ?? { ok: true }
    } catch (err) {
      output = { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
    this.send({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) },
    })
    this.send({ type: 'response.create' })
  }

  /** The user started talking over the model: drop what is still queued. */
  private bargeIn(): void {
    if (this.playing.size === 0) return
    this.stopPlayback()
    this.setPhase('listening')
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload))
  }

  private setPhase(phase: VoicePhase): void {
    if (this._phase === phase) return
    this._phase = phase
    this.opts.onPhase?.(phase)
  }

  private fail(message: string): void {
    this.opts.onError?.(message)
    this.setPhase('error')
  }
}

// --- helpers ------------------------------------------------------------------

interface RealtimeEvent {
  type: string
  delta?: unknown
  transcript?: unknown
  text?: unknown
  name?: unknown
  call_id?: unknown
  arguments?: unknown
  error?: unknown
  item?: unknown
}

function transcriptOf(event: RealtimeEvent): string | undefined {
  const candidates = [event.transcript, event.delta, event.text]
  for (const c of candidates) if (typeof c === 'string' && c.trim()) return c
  return undefined
}

function encodePcm16(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function decodePcm16(b64: string): Float32Array<ArrayBuffer> {
  const binary = atob(b64)
  const len = Math.floor(binary.length / 2)
  const out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const lo = binary.charCodeAt(i * 2)
    const hi = binary.charCodeAt(i * 2 + 1)
    let v = (hi << 8) | lo
    if (v >= 0x8000) v -= 0x10000
    out[i] = v / 0x8000
  }
  return out
}

/** Linear resampler, only used when the browser refuses a 24 kHz context. */
function resample(input: Float32Array, from: number, to: number): Float32Array {
  const ratio = from / to
  const length = Math.round(input.length / ratio)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const pos = i * ratio
    const idx = Math.floor(pos)
    const frac = pos - idx
    const a = input[idx] ?? 0
    const b = input[idx + 1] ?? a
    out[i] = a + (b - a) * frac
  }
  return out
}
