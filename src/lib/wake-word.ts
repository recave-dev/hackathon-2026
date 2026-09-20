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

// Leaving the meeting screen. Anchored on both ends so "kończymy spotkanie" is a
// command, but "jak kończymy spotkanie, wyślij notatkę" is not.
const EXIT = new RegExp(
  '^(?:(?:ok(?:ej)?|no|dobra|to|i)[,.!\\s]+)*' +
    '(?:' +
    'spotkanie\\s+(?:jest\\s+)?(?:sko[nń]czone|zako[nń]czone)' +
    '|ko[nń]czymy\\s+(?:to\\s+|ju[żz]\\s+)?spotkanie' +
    '|(?:zako[nń]cz|zamknij)\\s+spotkanie' +
    '|koniec\\s+spotkania' +
    '|(?:wyjd[źz]|wr[óo][ćc]|przejd[źz])\\s+do\\s+menu(?:\\s+g[łl][óo]wnego)?' +
    ')[.,!?…\\s]*$',
  'iu',
)

/** "Kończymy spotkanie", "wyjdź do menu": leave the meeting screen for the dashboard. */
export const isExit = (command: string): boolean => EXIT.test(command.trim())

const HESITATION = /^(?:y+|e+|hmm+|ehm+|eee|no|tak|więc|to|słuchaj|proszę|czekaj|moment)[.,!?…\s]*$/iu

const FILLER = /^(?:[\s,.!?;:—-]|powiedz(?: mi)?|pokaż(?: mi)?|proszę|tell me|show me)+/i

export function matchWake(text: string): WakeMatch {
  const m = WAKE.exec(text)
  if (!m) return { addressed: false, command: text.trim(), bare: false }
  const before = text.slice(0, m.index).trim()
  const after = text.slice(m.index + m[0].length).replace(FILLER, '').trim()
  // "…, Bolku?" at the end: the request is what came before.
  const command = after.length >= 3 ? after : before
  // Only the name, or the name plus a hesitation ("Bolek, ehm…"): the request comes next.
  // A real one-word command ("wyślij", "dzięki", "schowaj") is not bare.
  const bare = command.length === 0 || HESITATION.test(command)
  return { addressed: true, command: bare ? '' : command, bare }
}
