import { WebSocket, WebSocketServer, type RawData } from 'ws'

/**
 * Speech-to-text proxy for the meeting screen.
 *
 * The browser streams 16 kHz PCM16 audio frames here; this process forwards
 * them to xAI Grok Voice Transcribe over WebSocket and relays the transcript
 * events back unchanged. It exists so the xAI key never reaches the browser.
 *
 *   node --env-file=.env scripts/stt-proxy.ts
 *
 * Env: XAI_API_KEY (required), STT_PROXY_PORT (default 3002),
 *      STT_LANGUAGE (default pl), STT_KEYTERMS (comma list, default "Bolek").
 */

const apiKey = process.env.XAI_API_KEY?.trim()
if (!apiKey) {
  console.error('stt-proxy: XAI_API_KEY is not set')
  process.exit(1)
}

const port = Number(process.env.STT_PROXY_PORT ?? 3002)
const language = process.env.STT_LANGUAGE ?? 'pl'
const keyterms = (process.env.STT_KEYTERMS ?? 'Bolek,Bolku')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function upstreamUrl(): string {
  const params = new URLSearchParams({
    model: 'grok-voice-transcribe-2.0',
    sample_rate: '16000',
    encoding: 'pcm',
    interim_results: 'true',
    language,
    // End-of-turn detection: emit speech_final after a confident pause.
    smart_turn: '0.6',
    smart_turn_timeout: '1200',
  })
  for (const term of keyterms) params.append('keyterm', term)
  return `wss://api.x.ai/v1/stt?${params.toString()}`
}

const server = new WebSocketServer({ port })
console.log(`stt-proxy: listening on ws://localhost:${port} → api.x.ai (${language}, keyterms: ${keyterms.join(', ') || 'none'})`)

server.on('connection', (client, req) => {
  const id = Math.random().toString(36).slice(2, 7)
  const t0 = Date.now()
  let frames = 0
  let bytes = 0
  console.log(`[${id}] browser connected from ${req.socket.remoteAddress}`)

  const send = (payload: unknown) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload))
  }

  const upstream = new WebSocket(upstreamUrl(), { headers: { Authorization: `Bearer ${apiKey}` } })
  const queue: Buffer[] = []
  let ready = false

  upstream.on('open', () => console.log(`[${id}] upstream open (${Date.now() - t0} ms)`))

  upstream.on('message', (data: RawData) => {
    const text = data.toString()
    try {
      const event = JSON.parse(text) as { type?: string; text?: string; is_final?: boolean; speech_final?: boolean; message?: string }
      if (event.type === 'transcript.created') {
        ready = true
        for (const frame of queue) upstream.send(frame)
        queue.length = 0
        send({ type: 'proxy.status', state: 'ready', engine: 'grok-voice-transcribe-2.0' })
      } else if (event.type === 'transcript.partial' && event.speech_final) {
        console.log(`[${id}] utterance: "${event.text}"`)
      } else if (event.type === 'error') {
        console.error(`[${id}] upstream error: ${event.message}`)
      }
    } catch {
      /* not JSON; forward anyway */
    }
    if (client.readyState === WebSocket.OPEN) client.send(text)
  })

  upstream.on('error', (err) => {
    console.error(`[${id}] upstream socket error: ${err.message}`)
    send({ type: 'error', message: `Grok STT: ${err.message}` })
  })

  upstream.on('close', (code, reason) => {
    console.log(`[${id}] upstream closed ${code} ${reason.toString()} after ${frames} frames / ${(bytes / 32000).toFixed(1)} s audio`)
    send({ type: 'proxy.status', state: 'closed', code })
    if (client.readyState === WebSocket.OPEN) client.close()
  })

  client.on('message', (data: RawData, isBinary) => {
    if (isBinary) {
      frames++
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
      bytes += buf.length
      if (ready && upstream.readyState === WebSocket.OPEN) upstream.send(buf)
      else if (queue.length < 200) queue.push(buf)
      return
    }
    // Control messages ({"type":"finalize"} / {"type":"audio.done"}) pass through.
    if (upstream.readyState === WebSocket.OPEN) upstream.send(data.toString())
  })

  client.on('close', () => {
    console.log(`[${id}] browser disconnected`)
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify({ type: 'audio.done' }))
      setTimeout(() => upstream.close(), 1500)
    } else {
      upstream.close()
    }
  })
})
