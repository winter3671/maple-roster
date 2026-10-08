import type { HuntingInput, HuntingSummary } from '../../shared/contracts/hunting.contract'
import { hourlyProfit, sumIntegers } from './money'

export function huntingProfit(
  input: Pick<HuntingInput, 'mesos' | 'cost' | 'minutes'>,
  saleIncome = 0
) {
  const net = sumIntegers([input.mesos, saleIncome, -input.cost])
  return { net, hourlyNet: hourlyProfit(net, input.minutes) }
}

export function summarizeHunting(
  sessions: (HuntingInput & { saleIncome?: number })[]
): HuntingSummary {
  const income = sumIntegers(sessions.flatMap((item) => [item.mesos, item.saleIncome ?? 0]))
  const expense = sumIntegers(sessions.map((item) => item.cost))
  const timed = sessions.filter((item) => item.minutes > 0)
  const minutes = sumIntegers(timed.map((item) => item.minutes))
  const timedNet = sumIntegers(
    timed.flatMap((item) => [item.mesos, item.saleIncome ?? 0, -item.cost])
  )
  return {
    income,
    expense,
    net: sumIntegers([income, -expense]),
    count: sessions.length,
    minutes,
    hourlyNet: hourlyProfit(timedNet, minutes),
    solFragments: sumIntegers(sessions.map((item) => item.solFragments)),
    nodestones: sumIntegers(sessions.map((item) => item.nodestones))
  }
}
