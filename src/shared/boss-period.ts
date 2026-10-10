import { readDate } from './dates'
import { AppError } from './errors'

export type BossCycle = 'weekly' | 'monthly'
export function readBossCycle(value: unknown): BossCycle {
  if (value === undefined || value === 'weekly') return 'weekly'
  if (value === 'monthly') return 'monthly'
  throw new AppError('VALIDATION_ERROR', '보스 기록 주기를 확인해 주세요.')
}
export function bossMonth(date: string): string {
  return `${readDate(date).slice(0, 7)}-01`
}
export function shiftMonth(date: string, months: number): string {
  const day = new Date(`${bossMonth(date)}T00:00:00Z`)
  day.setUTCMonth(day.getUTCMonth() + months)
  return day.toISOString().slice(0, 10)
}
export function bossPeriod(date: string, cycle: BossCycle = 'weekly'): string {
  return cycle === 'monthly' ? bossMonth(date) : bossWeek(date)
}
export function bossPeriodEnd(date: string, cycle: BossCycle = 'weekly'): string {
  return cycle === 'monthly' ? shiftDate(shiftMonth(date, 1), -1) : shiftDate(bossWeek(date), 6)
}

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
