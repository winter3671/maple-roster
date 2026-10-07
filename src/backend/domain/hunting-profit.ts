import type { HuntingInput, HuntingSummary } from '../../shared/contracts/hunting.contract'
import { hourlyProfit, sumIntegers } from './money'

export function huntingProfit(input: Pick<HuntingInput, 'mesos' | 'cost' | 'minutes'>) {
  const net = sumIntegers([input.mesos, -input.cost])
  return { net, hourlyNet: hourlyProfit(net, input.minutes) }
}

export function summarizeHunting(sessions: HuntingInput[]): HuntingSummary {
  const income = sumIntegers(sessions.map((item) => item.mesos))
  const expense = sumIntegers(sessions.map((item) => item.cost))
  const timed = sessions.filter((item) => item.minutes > 0)
  const minutes = sumIntegers(timed.map((item) => item.minutes))
  const timedNet = sumIntegers(timed.map((item) => item.mesos - item.cost))
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
