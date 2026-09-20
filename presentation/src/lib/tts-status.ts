import { createServerFn } from '@tanstack/react-start'

/** Tells the start screen whether Grok Voice is available before any audio is requested. */
export const getTtsStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { ttsConfig } = await import('./tts-server')
  const config = ttsConfig()
  return { ttsConfigured: Boolean(config.apiKey), voice: config.voice }
})
