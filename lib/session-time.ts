/** Formatting for exam deadlines. Pure so both server and client can use it. */
export type TimeLeft = { label: string; expired: boolean; minutes: number }

export function timeLeft(deadlineAt: string | null | undefined, now = Date.now()): TimeLeft {
  if (!deadlineAt) return { label: 'No timer', expired: false, minutes: 0 }
  const ends = new Date(deadlineAt).getTime()
  if (!Number.isFinite(ends)) return { label: 'No timer', expired: false, minutes: 0 }
  const left = ends - now
  if (left <= 0) return { label: "Time's up", expired: true, minutes: 0 }
  const minutes = Math.ceil(left / 60000)
  if (left < 60000) return { label: `${Math.ceil(left / 1000)}s left`, expired: false, minutes: 0 }
  if (left < 3600000) return { label: `${minutes}m left`, expired: false, minutes }
  const hours = Math.floor(left / 3600000)
  return { label: `${hours}h ${Math.floor((left % 3600000) / 60000)}m left`, expired: false, minutes }
}
