import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Renders the placeholder poster for the "generate an image" demo tool to
 * `public/demo/meetup-003.png` with the installed Chrome. Replace the file with
 * a real graphic any time; the tool only serves it.
 *
 *   bun run demo:poster
 */

const OUT_DIR = resolve(process.cwd(), 'public/demo')
const OUT = resolve(OUT_DIR, 'meetup-003.png')
const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('Chrome not found; set CHROME_PATH')

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1600px;height:900px;font-family:-apple-system,Inter,Helvetica,Arial,sans-serif;color:#f4f4f5}
  body{background:radial-gradient(1200px 700px at 20% 10%,#1d4ed8 0%,#0b1020 55%,#05070f 100%);position:relative;overflow:hidden}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:80px 80px;mask-image:radial-gradient(900px 600px at 70% 60%,#000 30%,transparent 100%)}
  .orb{position:absolute;right:140px;top:170px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#93c5fd,#3b82f6 45%,#1e1b4b 100%);box-shadow:0 0 160px 40px rgba(59,130,246,.45),inset -60px -80px 120px rgba(0,0,0,.45)}
  .orb:after{content:"";position:absolute;inset:-40px;border-radius:50%;border:2px solid rgba(147,197,253,.35)}
  .text{position:absolute;left:110px;top:150px;width:820px}
  .brand{font-size:44px;letter-spacing:.35em;text-transform:uppercase;color:#93c5fd;font-weight:600}
  h1{font-size:180px;line-height:.95;margin:20px 0 30px;font-weight:800;letter-spacing:-.04em}
  h2{font-size:52px;font-weight:500;margin:0 0 50px;color:#e4e4e7}
  .meta{display:flex;gap:40px;font-size:34px;color:#cbd5e1}
  .meta b{color:#fff;display:block;font-size:40px}
  .foot{position:absolute;left:110px;bottom:70px;font-size:28px;color:#94a3b8;letter-spacing:.1em}
</style></head><body>
  <div class="grid"></div>
  <div class="orb"></div>
  <div class="text">
    <div class="brand">bielsko.ai</div>
    <h1>meetup<br>003</h1>
    <h2>Asystenci głosowi i AI na spotkaniach</h2>
    <div class="meta"><div><b>30 października 2026</b>czwartek, 17:00</div><div><b>NovaPatria</b>Bielsko-Biała</div></div>
  </div>
  <div class="foot">WSTĘP WOLNY · REJESTRACJA: LU.MA/BIELSKO-AI</div>
</body></html>`

const puppeteer = await import('puppeteer-core')
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  mkdirSync(OUT_DIR, { recursive: true })
  await page.screenshot({ path: OUT, type: 'png' })
  console.log('written', OUT)
} finally {
  await browser.close()
}
