import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import { GrokVoiceSession } from './grok-voice'
import type { VoicePhase, VoiceSessionOptions, VoiceTool } from './grok-voice'

export class VoiceUnavailableError extends Error {
  constructor(message = 'Agent głosowy nie jest skonfigurowany') {
    super(message)
    this.name = 'VoiceUnavailableError'
  }
}

interface Options {
  instructions: string
  tools?: VoiceTool[]
  keyterms?: string[]
  onToolCall?: VoiceSessionOptions['onToolCall']
  /** Written every frame with output loudness; the orb reads it directly. */
  levelRef?: RefObject<number>
  onError?: (message: string) => void
}

export interface GrokVoice {
  phase: VoicePhase
  active: boolean
  /** What the model is currently saying, or what the user just said. */
  caption: string | undefined
  captionFrom: 'agent' | 'user' | undefined
  start: () => Promise<void>
  stop: () => void
}

/**
 * React adapter over GrokVoiceSession. Instructions and tools are read at
 * `start()`, so a re-render with fresh state does not tear down the session.
 */
export function useGrokVoice(options: Options): GrokVoice {
  const [phase, setPhase] = useState<VoicePhase>('off')
  const [caption, setCaption] = useState<{ text: string; from: 'agent' | 'user' } | undefined>()
  const session = useRef<GrokVoiceSession | null>(null)
  const latest = useRef(options)
  latest.current = options

  const stop = useCallback(() => {
    session.current?.stop()
    session.current = null
    setPhase('off')
    setCaption(undefined)
  }, [])

  const start = useCallback(async () => {
    if (session.current) return
    const opts = latest.current
    setPhase('connecting')

    const res = await fetch('/api/voice-token', { method: 'POST' }).catch(() => undefined)
    if (!res || res.status === 503) {
      setPhase('off')
      throw new VoiceUnavailableError()
    }
    if (!res.ok) {
      setPhase('off')
      const detail = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(detail.error ?? `Token: HTTP ${res.status}`)
    }
    const { token } = (await res.json()) as { token: string }

    const next = new GrokVoiceSession({
      instructions: opts.instructions,
      tools: opts.tools,
      keyterms: opts.keyterms,
      onToolCall: (name, args) => latest.current.onToolCall?.(name, args),
      onPhase: setPhase,
      onAgentTranscript: (text) => setCaption(text ? { text, from: 'agent' } : undefined),
      onUserTranscript: (text) => setCaption({ text, from: 'user' }),
      onLevel: (level) => {
        if (latest.current.levelRef) latest.current.levelRef.current = level
      },
      onError: (message) => latest.current.onError?.(message),
    })
    session.current = next
    try {
      await next.start(token)
    } catch (err) {
      session.current = null
      setPhase('off')
      throw err
    }
  }, [])

  useEffect(() => () => session.current?.stop(), [])

  return {
    phase,
    active: phase !== 'off',
    caption: caption?.text,
    captionFrom: caption?.from,
    start,
    stop,
  }
}
