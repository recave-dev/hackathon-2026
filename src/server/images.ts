import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Server-only: "image generation" for the demo. There is no image model behind
 * this yet: the tool waits a realistic while and serves the poster committed
 * under `public/demo/`. Swap `generatePoster` for a real API call later; the
 * tool contract (prompt in, url out) stays the same.
 */

export interface GeneratedImage {
  url: string
  prompt: string
  width: number
  height: number
  tookMs: number
}

const POSTER = { file: 'public/demo/meetup-003.png', url: '/demo/meetup-003.png', width: 1672, height: 941 }

const delayMs = (): number => {
  const base = Number(process.env.IMAGE_DELAY_MS) || 7000
  return base + Math.round(Math.random() * base * 0.35)
}

export async function generatePoster(prompt: string): Promise<GeneratedImage> {
  const started = performance.now()
  if (!existsSync(resolve(process.cwd(), POSTER.file))) throw new Error(`Brak pliku ${POSTER.file}. Uruchom \`bun run demo:poster\` albo wgraj własną grafikę.`)
  await new Promise((r) => setTimeout(r, delayMs()))
  return { url: POSTER.url, prompt, width: POSTER.width, height: POSTER.height, tookMs: Math.round(performance.now() - started) }
}
