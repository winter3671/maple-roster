import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { expect, it } from 'vitest'
import { openDatabase } from '../database/connection'
import { LedgerRepository } from '../modules/ledger/ledger.repository'
import { LedgerService } from '../modules/ledger/ledger.service'
import { groupLedgerIncome } from '../../shared/ledger-income'
import { seedPerformanceLedger } from './fixtures/ledger-performance'

it.skipIf(process.env.MAPLE_RUN_LEDGER_PERF !== '1')(
  '거래 목록 페이지 조회 비용 측정',
  () => {
    for (const count of [1000, 10000, 100000]) {
      const root = mkdtempSync(join(tmpdir(), 'maple-ledger-perf-'))
      const database = openDatabase(join(root, 'synthetic.sqlite'))
      try {
        seedPerformanceLedger(database, count)
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        const query = { from: '2026-10-01', to: '2026-10-31' }
        const service = () => new LedgerService(new LedgerRepository(database))
        const cached = service()
        const full = cached.list(query),
          first = cached.page({ ...query, page: 1 })
        expect(first.summary).toEqual(full.summary)
        expect(first.incomeGroups).toEqual(groupLedgerIncome(full.entries))
        expect(first.entries).toHaveLength(50)
        const payloadBytes = {
          full: Buffer.byteLength(JSON.stringify(full)),
          page: Buffer.byteLength(JSON.stringify(first))
        }
        const methods = {
          full: () => {
            const list = cached.list(query)
            groupLedgerIncome(list.entries)
            return list
          },
          firstPage: () => service().page({ ...query, page: 1 }),
          nextPage: () => cached.page({ ...query, page: 2 })
        }
        for (const method of Object.values(methods)) method()
        const samples = {
          full: [] as number[],
          firstPage: [] as number[],
          nextPage: [] as number[]
        }
        for (let index = 0; index < 10; index++) {
          const order =
            index % 2
              ? (['nextPage', 'firstPage', 'full'] as const)
              : (['full', 'firstPage', 'nextPage'] as const)
          for (const name of order) {
            const started = performance.now(),
              result = methods[name]()
            samples[name].push(performance.now() - started)
            expect(result.summary.count).toBe(count)
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
            benchmark: 'ledger-page-query',
            records: count,
            repetitions: 10,
            full: timing(samples.full),
            firstPage: timing(samples.firstPage),
            nextPage: timing(samples.nextPage),
            payloadBytes
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
