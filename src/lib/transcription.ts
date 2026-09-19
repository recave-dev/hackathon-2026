import { useCallback, useEffect, useRef, useState } from 'react'

import { startGrokStt, type GrokSttSession } from './grok-stt'
import { useSpeechRecognition } from './speech'

/**
 * One microphone button, two engines. Grok Voice Transcribe through the local
 * proxy is preferred; when the proxy is unreachable the browser's own
 * recogniser takes over so the demo never loses its microphone.
 */

export type TranscriptionEngine = 'grok' | 'browser'
export type TranscriptionStatus = 'idle' | 'connecting' | 'listening' | 'error' | 'unsupported'

export function useTranscription(onFinal: (text: string) => void) {
  const browser = useSpeechRecognition(onFinal)
  const [engine, setEngine] = useState<TranscriptionEngine | null>(null)
  const [grokStatus, setGrokStatus] = useState<TranscriptionStatus>('idle')
  const [grokInterim, setGrokInterim] = useState('')
  const [grokError, setGrokError] = useState<string | null>(null)
  const session = useRef<GrokSttSession | null>(null)
  const handler = useRef(onFinal)
  handler.current = onFinal

  const stop = useCallback(() => {
    session.current?.stop()
    session.current = null
    browser.stop()
    setGrokStatus('idle')
    setGrokInterim('')
    setEngine(null)
  }, [browser])

  const start = useCallback(async () => {
    setGrokError(null)
    try {
      setGrokStatus('connecting')
      const s = await startGrokStt({
        onFinal: (text) => handler.current(text),
        onInterim: setGrokInterim,
        onStatus: (status, detail) => {
          if (status === 'ready') setGrokStatus('listening')
          else if (status === 'error') {
            setGrokError(detail ?? 'błąd')
            setGrokStatus('error')
          } else if (status === 'closed') {
            setGrokStatus((prev) => (prev === 'error' ? prev : 'idle'))
          }
        },
      })
      session.current = s
      setEngine('grok')
    } catch (err) {
      // Proxy down or mic denied: fall back to the browser recogniser.
      setGrokStatus('idle')
      setGrokError(err instanceof Error ? err.message : String(err))
      setEngine('browser')
      browser.start()
    }
  }, [browser])

  useEffect(() => () => session.current?.stop(), [])

  const active = engine === 'grok' ? grokStatus : engine === 'browser' ? browser.status : 'idle'
  const status: TranscriptionStatus = active === 'unsupported' ? 'unsupported' : active
  return {
    engine,
    status,
    listening: status === 'listening' || status === 'connecting',
    interim: engine === 'grok' ? grokInterim : browser.interim,
    error: engine === 'grok' ? grokError : (browser.error ?? grokError),
    start,
    stop,
  }
}
