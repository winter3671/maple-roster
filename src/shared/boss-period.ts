import { readDate } from './dates'

// Weekly bosses reset on Thursday at 00:00 KST. Inputs are KST calendar dates.
export function bossWeek(date: string): string {
  const day = new Date(`${readDate(date)}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 3) % 7))
  return day.toISOString().slice(0, 10)
}
export function shiftDate(date: string, days: number): string {
  const day = new Date(`${readDate(date)}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}
