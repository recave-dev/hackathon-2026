/**
 * Wake-word handling for the meeting assistant. The assistant is called "Bolek".
 * People address him in the vocative ("Bolku!") and recognisers occasionally
 * misspell him, so those forms count too.
 */

export const ASSISTANT_NAME = 'Bolek'

/** Forms of the name as spoken or as the recogniser spells them. */
const VARIANTS = ['bolek', 'bolku', 'bolka', 'bolkiem', 'bolec', 'bollek', 'polek', 'bolik']
const WAKE = new RegExp(`(^|[\\s,.!?;:—-])(?:hej\\s+|hey\\s+|ej\\s+)?(${VARIANTS.join('|')})(?=$|[\\s,.!?;:—-])`, 'i')

export interface WakeMatch {
  /** True when the utterance contains the name. */
  addressed: boolean
  /** The utterance with the name and leading filler removed. */
  command: string
  /** True when nothing but the name was said, so the request comes next. */
  bare: boolean
}

// `\b` is ASCII-only in JS, so a Polish letter before punctuation needs an explicit lookahead.
const DISMISS = /^(?:ok(?:ej)?[,.!\s]*|no[,.!\s]*|dobra[,.!\s]*|to\s+)?(?:dzi[eę]ki|dzi[eę]kuj[eę](?:my)?|wystarczy|schowaj|zamknij|to\s+wszystko|koniec|starczy)(?![\p{L}\p{N}])/iu

/** "Bolek, dzięki" and friends: hide what is on screen instead of looking something up. */
export const isDismissal = (command: string): boolean => DISMISS.test(command.trim())

const FILLER = /^(?:[\s,.!?;:—-]|powiedz(?: mi)?|pokaż(?: mi)?|proszę|tell me|show me)+/i

export function matchWake(text: string): WakeMatch {
  const m = WAKE.exec(text)
  if (!m) return { addressed: false, command: text.trim(), bare: false }
  const before = text.slice(0, m.index).trim()
  const after = text.slice(m.index + m[0].length).replace(FILLER, '').trim()
  // "…, Bolku?" at the end: the request is what came before.
  const command = after.length >= 3 ? after : before
  // A single word after the name is usually a hesitation ("Bolek, ehm"); "Bolek, dzięki" is a command.
  const bare = command.split(/\s+/).filter(Boolean).length < 2 && !isDismissal(command)
  return { addressed: true, command: bare ? '' : command, bare }
}
