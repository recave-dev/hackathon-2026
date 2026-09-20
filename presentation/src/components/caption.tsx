import { useMemo } from 'react'

export interface CaptionProps {
  text: string
  spokenChars: number
}

/** Word-level subtitle; words light up as the voice reaches them. */
export const Caption = ({ text, spokenChars }: CaptionProps) => {
  const words = useMemo(() => {
    const out: { word: string; end: number }[] = []
    for (const match of text.matchAll(/\S+\s*/g)) {
      // Speech tags such as [pause] are spoken as silence; keep their offsets, hide the text.
      if (/^\[[a-z-]+\]\s*$/i.test(match[0])) continue
      out.push({ word: match[0], end: match.index + match[0].trimEnd().length })
    }
    return out
  }, [text])

  return (
    <p className="m-0 text-balance text-[15px] leading-snug tracking-tight md:text-base" aria-live="off">
      {words.map((w, i) => (
        <span key={i} className="caption-word" data-spoken={spokenChars >= w.end ? 'true' : 'false'}>
          {w.word}
        </span>
      ))}
    </p>
  )
}
