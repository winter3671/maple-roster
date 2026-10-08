import type { BossRun } from '../../shared/contracts/boss.contract'
import { sumIntegers } from './money'

export function crystalShare(price: number, partySize: number): number {
  return Number(BigInt(price) / BigInt(partySize))
}
export function summarizeBosses(runs: BossRun[]) {
  return {
    count: runs.length,
    cleared: runs.filter((run) => run.isCleared).length,
    sold: runs.filter((run) => run.settlement !== null).length,
    expected: sumIntegers(runs.map((run) => run.expectedShare)),
    clearedUnsold: sumIntegers(
      runs.filter((run) => run.isCleared && !run.settlement).map((run) => run.expectedShare)
    ),
    settled: sumIntegers(runs.map((run) => run.settlement?.amount ?? 0))
  }
}
