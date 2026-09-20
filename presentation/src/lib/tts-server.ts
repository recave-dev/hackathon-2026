import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { narrationKey } from './narration.ts'

/**
 * Server-side wrapper around xAI Grok Voice text-to-speech (POST /v1/tts).
 * Clips are requested with character timestamps so the client can fire cues and
 * highlight captions in sync, and cached on disk so a slide costs one call.
 */

export interface SpeechClip {
  /** Base64 audio in `contentType`. */
  audio: string
  contentType: string
  /** Seconds. */
  duration: number
  /** Each input character in order; parallel to `times`. */
  chars: string[]
  /** `[start, end]` seconds per character. */
  times: [number, number][]
  voice: string
  cached: boolean
}

export interface TtsConfig {
  apiKey: string | undefined
  voice: string
  language: string
  cacheDir: string
}

export const ttsConfig = (): TtsConfig => ({
  apiKey: process.env.XAI_API_KEY?.trim() || undefined,
  voice: (process.env.TTS_VOICE?.trim() || 'ara').toLowerCase(),
  language: process.env.TTS_LANGUAGE?.trim() || 'auto',
  cacheDir: process.env.TTS_CACHE_DIR?.trim() || '.cache/tts',
})

interface XaiTtsResponse {
  audio: string
  content_type?: string
  duration?: number
  audio_timestamps?: { graph_chars: string[]; graph_times: [number, number][] }
}

export class TtsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const cachePath = async (config: TtsConfig, text: string): Promise<string> => {
  const key = await narrationKey(text, config.voice, config.language)
  return path.resolve(config.cacheDir, `${key}.json`)
}

export async function readCachedClip(config: TtsConfig, text: string): Promise<SpeechClip | null> {
  try {
    const raw = await readFile(await cachePath(config, text), 'utf8')
    return { ...(JSON.parse(raw) as SpeechClip), cached: true }
  } catch {
    return null
  }
}

export async function synthesize(config: TtsConfig, text: string, { voice = config.voice }: { voice?: string } = {}): Promise<SpeechClip> {
  const effective = { ...config, voice: voice.toLowerCase() }
  const cached = await readCachedClip(effective, text)
  if (cached) return cached

  if (!effective.apiKey) throw new TtsError('XAI_API_KEY is not set on the server.', 503)
  if (!text.trim()) throw new TtsError('Nothing to say.', 400)
  if (text.length > 15_000) throw new TtsError('Narration exceeds the 15 000 character limit.', 400)

  const response = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${effective.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice_id: effective.voice,
      language: effective.language,
      with_timestamps: true,
      output_format: { codec: 'mp3', sample_rate: 24000, bit_rate: 96000 },
    }),
  })
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw new TtsError(`xAI TTS ${response.status}: ${detail}`, response.status === 401 ? 502 : response.status)
  }
  const payload = (await response.json()) as XaiTtsResponse
  const clip: SpeechClip = {
    audio: payload.audio,
    contentType: payload.content_type ?? 'audio/mpeg',
    duration: payload.duration ?? 0,
    chars: payload.audio_timestamps?.graph_chars ?? [],
    times: payload.audio_timestamps?.graph_times ?? [],
    voice: effective.voice,
    cached: false,
  }

  try {
    const file = await cachePath(effective, text)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify({ ...clip, cached: undefined }))
  } catch (error) {
    console.warn('tts: could not write cache', error)
  }
  return clip
}
