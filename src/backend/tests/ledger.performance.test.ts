import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { expect, it } from 'vitest'
import { openDatabase } from '../database/connection'
import { dashboardStats } from '../domain/dashboard'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import { seedPerformanceLedger } from './fixtures/ledger-performance'

it.skipIf(process.env.MAPLE_RUN_LEDGER_PERF !== '1')(
  '대량 장부 대시보드 조회 비용 측정',
  () => {
    for (const count of [1000, 10000, 100000]) {
      const root = mkdtempSync(join(tmpdir(), 'maple-ledger-perf-'))
      const database = openDatabase(join(root, 'synthetic.sqlite'))
      try {
        seedPerformanceLedger(database, count)
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        const service = new LedgerService(new LedgerRepository(database))
        const query = { from: '2026-10-01', to: '2026-10-31' }
        const baseline = () => dashboardStats(service.list(query), query)
        const optimized = () => service.dashboard(query)
        expect(optimized()).toEqual(baseline())
        // Warm both paths and alternate their order to limit cache/order bias.
        baseline()
        optimized()
        const samples = { baseline: [] as number[], optimized: [] as number[] }
        for (let index = 0; index < 10; index++) {
          const methods =
            index % 2 ? (['optimized', 'baseline'] as const) : (['baseline', 'optimized'] as const)
          for (const method of methods) {
            const started = performance.now()
            const result = method === 'baseline' ? baseline() : optimized()
            samples[method].push(performance.now() - started)
            expect(result.summary.count).toBe(count)
            expect(result.recent).toHaveLength(5)
          }
        }
        const timing = (values: number[]) => {
          values.sort((a, b) => a - b)
          return {
            medianMs: Number(((values[4] + values[5]) / 2).toFixed(2)),
            p95Ms: Number(values[9].toFixed(2))
          }
        }
        console.log(
          JSON.stringify({
            benchmark: 'dashboard-query',
            records: count,
            repetitions: 10,
            baseline: timing(samples.baseline),
            optimized: timing(samples.optimized),
            fullDetailRows: { baseline: count, optimized: 5 }
          })
        )
      } finally {
        database.close()
        const target = resolve(root)
        if (
          dirname(target) !== resolve(tmpdir()) ||
          !basename(target).startsWith('maple-ledger-perf-')
        )
          throw new Error('Unexpected benchmark cleanup path')
        rmSync(target, { recursive: true, force: true })
      }
    }
  },
  120000
)
