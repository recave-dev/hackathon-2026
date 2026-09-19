const DAY_MS = 24 * 60 * 60 * 1000

export const parseLocal = (iso: string): Date => new Date(iso)

const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export const addMinutes = (iso: string, minutes: number): string =>
  toLocalIso(new Date(parseLocal(iso).getTime() + minutes * 60_000))

export const addDays = (iso: string, days: number): string =>
  toLocalIso(new Date(parseLocal(iso).getTime() + days * DAY_MS))

/** Serialises as local wall-clock time without a zone, matching the seed format. */
export function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const timeFmt = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' })
const dayMonthFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' })
const shortDayMonthFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' })
const longFmt = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const dateTimeFmt = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatTime = (iso: string): string => timeFmt.format(parseLocal(iso))
export const formatDayMonth = (iso: string): string => dayMonthFmt.format(parseLocal(iso))
export const formatLongDate = (iso: string): string => longFmt.format(parseLocal(iso))
export const formatDateTime = (iso: string): string => dateTimeFmt.format(parseLocal(iso))

/** "dziś 16:00", "jutro 12:00", "12 lis, 12:00" — relative to the demo clock. */
export function formatDue(iso: string, now: string): string {
  const target = parseLocal(iso)
  const diffDays = Math.round((startOfDay(target) - startOfDay(parseLocal(now))) / DAY_MS)
  const time = timeFmt.format(target)
  if (diffDays === 0) return `dziś ${time}`
  if (diffDays === 1) return `jutro ${time}`
  if (diffDays === -1) return `wczoraj ${time}`
  return `${shortDayMonthFmt.format(target)}, ${time}`
}

/** "dziś", "jutro", "wczoraj", "12 lis" — used for feeds where time is shown separately. */
export function formatRelativeDay(iso: string, now: string): string {
  const diffDays = Math.round((startOfDay(parseLocal(iso)) - startOfDay(parseLocal(now))) / DAY_MS)
  if (diffDays === 0) return 'dziś'
  if (diffDays === 1) return 'jutro'
  if (diffDays === -1) return 'wczoraj'
  return shortDayMonthFmt.format(parseLocal(iso))
}

export const isOverdue = (iso: string, now: string): boolean =>
  parseLocal(iso).getTime() < parseLocal(now).getTime()

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function greetingFor(iso: string): string {
  const h = parseLocal(iso).getHours()
  if (h < 12) return 'Dobry poranek'
  if (h < 18) return 'Dobry dzień'
  return 'Dobry wieczór'
}

export const firstName = (fullName: string): string => fullName.split(' ')[0] ?? fullName

export const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/** "1 224 EUR" — thousands grouped with a narrow space, cents only when present. */
export function formatMoney(amount: number, currency: string): string {
  const digits = Number.isInteger(amount) ? 0 : 2
  const [whole, fraction] = Math.abs(amount).toFixed(digits).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
  return `${amount < 0 ? '−' : ''}${grouped}${fraction ? `,${fraction}` : ''} ${currency}`
}

const monthShortFmt = new Intl.DateTimeFormat('pl-PL', { month: 'short' })
export const formatMonthShort = (iso: string): string => monthShortFmt.format(parseLocal(iso)).replace('.', '')
