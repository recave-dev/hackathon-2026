import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Thin hook over the browser Web Speech API (Chrome, Edge, Safari). Emits final
 * phrases through `onFinal`; interim text is exposed for live captions.
 */

interface RecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}

interface RecognitionEventLike {
  resultIndex: number
  results: ArrayLike<RecognitionResultLike>
}

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionCtor = new () => RecognitionLike

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export type SpeechStatus = 'unsupported' | 'idle' | 'listening' | 'error'

export function useSpeechRecognition(onFinal: (text: string) => void, lang = 'pl-PL') {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognition = useRef<RecognitionLike | null>(null)
  const wanted = useRef(false)
  const handler = useRef(onFinal)
  handler.current = onFinal

  useEffect(() => {
    if (!getRecognitionCtor()) setStatus('unsupported')
  }, [])

  const stop = useCallback(() => {
    wanted.current = false
    recognition.current?.stop()
    recognition.current = null
    setInterim('')
    setStatus((s) => (s === 'unsupported' ? s : 'idle'))
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setStatus('unsupported')
      return
    }
    recognition.current?.abort()
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (event) => {
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result) continue
        const text = result[0].transcript.trim()
        if (!text) continue
        if (result.isFinal) handler.current(text)
        else interimText += `${text} `
      }
      setInterim(interimText.trim())
    }
    rec.onerror = (event) => {
      // "no-speech" and "aborted" are routine; anything else is worth showing.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      setError(event.error)
      setStatus('error')
      wanted.current = false
    }
    rec.onend = () => {
      // Chrome stops continuous recognition after a while; restart while wanted.
      if (wanted.current && recognition.current === rec) {
        try {
          rec.start()
          return
        } catch {
          /* fall through to idle */
        }
      }
      if (recognition.current === rec) {
        recognition.current = null
        setStatus((s) => (s === 'error' ? s : 'idle'))
      }
    }
    recognition.current = rec
    wanted.current = true
    setError(null)
    setStatus('listening')
    rec.start()
  }, [lang])

  useEffect(() => () => recognition.current?.abort(), [])

  return { status, interim, error, start, stop }
}
