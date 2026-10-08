import type { BossRun } from '../../shared/contracts/boss.contract'
import { sumIntegers } from './money'

export { crystalShare } from '../../shared/crystal-prices'
export function summarizeBosses(runs: BossRun[]) {
  return {
    count: runs.length,
    cleared: runs.filter((run) => run.isCleared).length,
    sold: runs.filter((run) => run.settlement !== null).length,
    expected: sumIntegers(runs.map((run) => run.expectedShare)),
    clearedUnsold: sumIntegers(
      runs.filter((run) => run.isCleared && !run.settlement).map((run) => run.expectedShare)
    ),
    settled: sumIntegers(runs.map((run) => run.settlement?.amount ?? 0)),
    remaining: sumIntegers(runs.filter((run) => !run.isCleared).map((run) => run.expectedShare))
  }
}
