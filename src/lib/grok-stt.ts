/**
 * Microphone → 16 kHz PCM16 → STT proxy (→ xAI Grok Voice Transcribe).
 *
 * The proxy (`scripts/stt-proxy.ts`) relays Grok's transcript events verbatim:
 * `transcript.partial` chunks with `is_final` (chunk done) and `speech_final`
 * (utterance done). We stitch final chunks into one utterance and emit it on
 * `speech_final`, which is when the meeting screen runs the wake word and Jev.
 */

export interface TranscriptEvent {
  type: string
  text?: string
  is_final?: boolean
  speech_final?: boolean
  message?: string
  state?: string
  engine?: string
}

export interface GrokSttHandlers {
  onFinal: (text: string) => void
  onInterim: (text: string) => void
  onStatus: (status: 'connecting' | 'ready' | 'closed' | 'error', detail?: string) => void
}

export interface GrokSttSession {
  stop: () => void
}

const FRAME_SAMPLES = 1600 // 100 ms at 16 kHz

/** Inline AudioWorklet: forwards mono Float32 blocks to the main thread. */
const WORKLET_SOURCE = `
class PcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) this.port.postMessage(ch.slice(0))
    return true
  }
}
registerProcessor('pcm-tap', PcmTap)
`

export const defaultProxyUrl = (): string => {
  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_STT_WS_URL
  if (fromEnv) return fromEnv
  if (typeof window === 'undefined') return 'ws://localhost:3002'
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.hostname}:3002`
}

/** Opens the proxy socket first; rejects if it cannot connect, so callers can fall back. */
export async function startGrokStt(handlers: GrokSttHandlers, url = defaultProxyUrl()): Promise<GrokSttSession> {
  handlers.onStatus('connecting')
  const ws = await new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    const timer = window.setTimeout(() => {
      socket.close()
      reject(new Error('Proxy STT nie odpowiada (uruchom `npm run stt:proxy`).'))
    }, 2500)
    socket.onopen = () => {
      window.clearTimeout(timer)
      resolve(socket)
    }
    socket.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('Nie można połączyć z proxy STT.'))
    }
  })

  let finalBuffer = ''
  let stopped = false

  ws.onmessage = (msg) => {
    let event: TranscriptEvent
    try {
      event = JSON.parse(String(msg.data)) as TranscriptEvent
    } catch {
      return
    }
    if (event.type === 'proxy.status') {
      if (event.state === 'ready') handlers.onStatus('ready', event.engine)
      else if (event.state === 'closed') handlers.onStatus('closed')
      return
    }
    if (event.type === 'error') {
      handlers.onStatus('error', event.message)
      return
    }
    if (event.type !== 'transcript.partial') return
    const text = (event.text ?? '').trim()
    if (event.speech_final) {
      // The speech_final event carries the whole utterance, chunks included;
      // only prepend the buffer if the server sent just the tail.
      const utterance = !finalBuffer || text.includes(finalBuffer) ? text : `${finalBuffer} ${text}`.trim()
      finalBuffer = ''
      handlers.onInterim('')
      if (utterance) handlers.onFinal(utterance)
    } else if (event.is_final) {
      finalBuffer = `${finalBuffer} ${text}`.trim()
      handlers.onInterim(finalBuffer)
    } else {
      handlers.onInterim(`${finalBuffer} ${text}`.trim())
    }
  }
  ws.onclose = () => {
    if (!stopped) handlers.onStatus('closed')
  }

  // Microphone capture. Asking for 16 kHz lets the browser resample for us.
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const context = new AudioContext({ sampleRate: 16000 })
  const workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }))
  await context.audioWorklet.addModule(workletUrl)
  URL.revokeObjectURL(workletUrl)
  const source = context.createMediaStreamSource(stream)
  const tap = new AudioWorkletNode(context, 'pcm-tap', { numberOfInputs: 1, numberOfOutputs: 0 })
  source.connect(tap)

  const ratio = context.sampleRate / 16000
  let pending = new Int16Array(FRAME_SAMPLES)
  let filled = 0
  tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
    if (ws.readyState !== WebSocket.OPEN) return
    const input = e.data
    // Nearest-sample downsample if the context refused 16 kHz (Safari).
    const count = Math.floor(input.length / ratio)
    for (let i = 0; i < count; i++) {
      const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] ?? 0))
      pending[filled++] = s < 0 ? s * 0x8000 : s * 0x7fff
      if (filled === FRAME_SAMPLES) {
        ws.send(pending.buffer)
        pending = new Int16Array(FRAME_SAMPLES)
        filled = 0
      }
    }
  }

  return {
    stop: () => {
      stopped = true
      tap.port.onmessage = null
      source.disconnect()
      tap.disconnect()
      for (const track of stream.getTracks()) track.stop()
      void context.close()
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'finalize' }))
      window.setTimeout(() => ws.close(), 300)
    },
  }
}
