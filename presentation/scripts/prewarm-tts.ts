/**
 * Synthesizes the narration of every slide once so the live presentation only
 * reads from the disk cache (no network round-trip, no surprise on stage).
 *
 *   node --env-file=.env scripts/prewarm-tts.ts
 */
import { parseNarration } from '../src/lib/narration.ts'
import { NARRATION } from '../src/slides/narration.ts'
import { readCachedClip, synthesize, ttsConfig } from '../src/lib/tts-server.ts'

const config = ttsConfig()
if (!config.apiKey) {
  console.error('prewarm-tts: XAI_API_KEY is not set (copy .env.example to .env).')
  process.exit(1)
}

let seconds = 0
let calls = 0
for (const [id, raw] of Object.entries(NARRATION)) {
  const { text } = parseNarration(raw)
  const hit = await readCachedClip(config, text)
  if (hit) {
    seconds += hit.duration
    console.log(`  cached  ${id.padEnd(14)} ${hit.duration.toFixed(1)}s`)
    continue
  }
  const t0 = Date.now()
  const clip = await synthesize(config, text)
  calls++
  seconds += clip.duration
  console.log(`  synth   ${id.padEnd(14)} ${clip.duration.toFixed(1)}s  (${Date.now() - t0} ms, ${text.length} chars)`)
}
console.log(`\n${Object.keys(NARRATION).length} slides, ${calls} new calls, ${(seconds / 60).toFixed(1)} min of narration, voice "${config.voice}".`)
