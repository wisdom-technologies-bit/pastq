/** One timezone for every date label and grouping decision on the site.
 *  Africa/Lagos has no daylight saving, so calendar arithmetic on day keys is
 *  exact. Everything is computed with Intl, never the server's timezone. */
export const TIME_ZONE = 'Africa/Lagos'

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const headingFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
})

const stampDateFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' })

const stampTimeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false })

/** 'YYYY-MM-DD' for the Lagos calendar day that contains this instant. */
export function dayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '1970-01-01'
  return dayFormatter.format(date)
}

export function todayKey(now: Date = new Date()): string {
  return dayKey(now)
}

/** Day keys are calendar labels, so shift them in UTC to avoid any host clock. */
export function addDays(key: string, days: number): string {
  const base = new Date(`${key}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

/** Monday = 0 … Sunday = 6 for a Lagos day key. */
export function weekdayIndex(key: string): number {
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay()
  return (weekday + 6) % 7
}

/** Monday of the Lagos week containing `now`. */
export function weekStartKey(now: Date = new Date()): string {
  const key = todayKey(now)
  return addDays(key, -weekdayIndex(key))
}

const midday = (key: string) => new Date(`${key}T12:00:00Z`)

/** "Today", "Yesterday" or "Mon 27 Oct". */
export function dayHeading(key: string, now: Date = new Date()): string {
  const today = todayKey(now)
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  return headingFormatter.format(midday(key))
}

/** "27 Oct" for a timestamp, in Lagos time. */
export function shortDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return shortDateFormatter.format(date)
}

/** "27 Oct 2026" for a timestamp, in Lagos time. Undated values return ''. */
export function calendarDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return stampDateFormatter.format(date)
}

/** "12 Oct 2026, 18:04" stamp used in tooltips and titles. */
export function stamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${stampDateFormatter.format(date)}, ${stampTimeFormatter.format(date)}`
}

/** "1h 12m", "12m", "38s" — compact study time. */
export function durationLabel(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total}s`
  const minutes = Math.round(total / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}
