/**
 * Narration is plain text with `{{cue-id}}` markers at the points where the
 * orb should fly to the slide element with that id. Shared by the server (which
 * strips the markers before synthesis) and the client (which maps marker
 * offsets onto character timestamps to fire cues at the right moment).
 */

export interface NarrationCue {
  id: string
  /** Character offset in the cleaned text where the cue fires. */
  offset: number
}

export interface ParsedNarration {
  text: string
  cues: NarrationCue[]
}

const MARKER = /\{\{\s*([a-z0-9_-]+)\s*\}\}/gi

export function parseNarration(raw: string): ParsedNarration {
  const source = raw.trim()
  const cues: NarrationCue[] = []
  let text = ''
  let last = 0
  for (const match of source.matchAll(MARKER)) {
    text += source.slice(last, match.index)
    let end = match.index + match[0].length
    // A marker between two spaces would leave a doubled space behind; keep one.
    if (/\s$/.test(text) && /^\s/.test(source.slice(end))) end += 1
    cues.push({ id: match[1]!.toLowerCase(), offset: text.length })
    last = end
  }
  text += source.slice(last)
  return { text: text.trimEnd(), cues }
}

/** Stable identity for a narration under a given voice, used as the cache key. */
export async function narrationKey(text: string, voice: string, language: string): Promise<string> {
  const payload = new TextEncoder().encode(`${voice}\u0000${language}\u0000${text}`)
  const digest = await crypto.subtle.digest('SHA-256', payload)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
