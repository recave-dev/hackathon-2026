import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { TtsError, synthesize, ttsConfig } from '@/lib/tts-server'

/**
 * Text-to-speech proxy. The browser never sees the xAI key: it posts the
 * narration here and gets back base64 audio plus per-character timestamps.
 */
export const Route = createFileRoute('/api/tts')({
  server: {
    handlers: {
      GET: () => {
        const config = ttsConfig()
        return json({ configured: Boolean(config.apiKey), voice: config.voice, language: config.language })
      },
      POST: async ({ request }) => {
        let body: { text?: unknown; voice?: unknown }
        try {
          body = (await request.json()) as typeof body
        } catch {
          return json({ error: 'Body must be JSON.' }, { status: 400 })
        }
        const text = typeof body.text === 'string' ? body.text : ''
        const voice = typeof body.voice === 'string' && /^[a-z0-9_-]{1,64}$/i.test(body.voice) ? body.voice : undefined
        try {
          const clip = await synthesize(ttsConfig(), text, { voice })
          return json(clip, { headers: { 'Cache-Control': 'private, max-age=86400' } })
        } catch (error) {
          if (error instanceof TtsError) return json({ error: error.message }, { status: error.status })
          console.error('tts: synthesis failed', error)
          return json({ error: 'Synthesis failed.' }, { status: 502 })
        }
      },
    },
  },
})
