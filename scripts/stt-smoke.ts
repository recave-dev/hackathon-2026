import { readFileSync } from 'node:fs'

import { WebSocket } from 'ws'

/**
 * Streams a 16 kHz mono PCM16 WAV through the STT proxy at real-time pace and
 * prints Grok's transcript events. Make a test file on macOS with:
 *
 *   say -v Zosia -o bolek.wav --data-format=LEI16@16000 "Bolek, kim jest Darek Wylon?"
 *   node scripts/stt-smoke.ts bolek.wav
 */

const path = process.argv[2]
if (!path) {
  console.error('usage: node scripts/stt-smoke.ts <file.wav>')
  process.exit(1)
}
const pcm = readFileSync(path).subarray(44)
const ws = new WebSocket(process.env.STT_WS_URL ?? 'ws://localhost:3002')
const t0 = Date.now()
const stamp = () => `${String(Date.now() - t0).padStart(6)} ms`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

ws.on('open', async () => {
  console.log(stamp(), 'proxy open, streaming', (pcm.length / 32000).toFixed(1), 's of audio')
  const frame = 3200
  for (let i = 0; i < pcm.length; i += frame) {
    ws.send(pcm.subarray(i, i + frame))
    await sleep(100)
  }
  const silence = Buffer.alloc(frame)
  for (let i = 0; i < 15; i++) {
    ws.send(silence)
    await sleep(100)
  }
  ws.send(JSON.stringify({ type: 'finalize' }))
  await sleep(1500)
  ws.close()
})
ws.on('message', (d) => {
  const e = JSON.parse(d.toString()) as { type: string; text?: string; is_final?: boolean; speech_final?: boolean; end_of_turn_confidence?: number }
  if (e.type === 'transcript.partial') {
    const flag = e.speech_final ? 'UTTERANCE' : e.is_final ? 'chunk    ' : 'interim  '
    console.log(stamp(), flag, JSON.stringify(e.text), e.end_of_turn_confidence !== undefined ? `eot=${e.end_of_turn_confidence.toFixed(2)}` : '')
  } else console.log(stamp(), JSON.stringify(e).slice(0, 160))
})
ws.on('close', () => process.exit(0))
ws.on('error', (e) => console.error('error', e.message))
