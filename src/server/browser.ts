import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Server-only: a headless Chrome for page screenshots, driven through the
 * DevTools protocol with puppeteer-core. Uses the Chrome already installed on
 * the machine, so nothing is downloaded. The browser stays open between calls.
 * Screenshots go to `public/shots/`, which Vite serves at `/shots/<file>` in dev.
 */

export interface Shot {
  file: string
  /** Public path the screen can load. */
  url: string
  pageUrl: string
  title: string
  tookMs: number
}

export const SHOTS_DIR = resolve(process.cwd(), process.env.SHOTS_DIR ?? 'public/shots')

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p))

type Browser = Awaited<ReturnType<typeof import('puppeteer-core').launch>>
const shared = globalThis as { __bolekBrowser?: Promise<Browser> }

async function getBrowser(): Promise<Browser> {
  if (shared.__bolekBrowser) {
    const b = await shared.__bolekBrowser
    if (b.connected) return b
  }
  const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p))
  if (!executablePath) throw new Error('Nie znalazłem Chrome. Ustaw CHROME_PATH w .env.')
  const puppeteer = await import('puppeteer-core')
  shared.__bolekBrowser = puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars'] })
  return shared.__bolekBrowser
}

export async function screenshotPage(rawUrl: string, opts: { fullPage?: boolean; width?: number; height?: number } = {}): Promise<Shot> {
  const started = performance.now()
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: opts.width ?? 1440, height: opts.height ?? 900, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 }).catch(async (err: unknown) => {
      // Slow trackers keep networkidle from settling; a loaded DOM is good enough for a screenshot.
      if (page.url() === 'about:blank') throw err
    })
    await new Promise((r) => setTimeout(r, 600))
    mkdirSync(SHOTS_DIR, { recursive: true })
    const file = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.png`
    await page.screenshot({ path: resolve(SHOTS_DIR, file), fullPage: opts.fullPage ?? false, type: 'png' })
    const title = await page.title().catch(() => '')
    return { file, url: `/shots/${file}`, pageUrl: page.url(), title, tookMs: Math.round(performance.now() - started) }
  } finally {
    await page.close().catch(() => {})
  }
}
