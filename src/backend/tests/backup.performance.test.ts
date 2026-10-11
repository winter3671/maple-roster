import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { it, expect } from 'vitest'
import { AutomaticBackupService } from '../modules/backup/automatic-backup.service'

// Explicit benchmark only: synthetic payloads, isolated files, no user data or API calls.
it.skipIf(process.env.MAPLE_RUN_PERF !== '1')(
  '자동 백업 반복 확인 비용 측정',
  () => {
    for (const count of [1000, 10000]) {
      const root = mkdtempSync(join(tmpdir(), 'maple-backup-perf-'))
      try {
        let exports = 0
        const content = JSON.stringify({
          format: 'maple-roster',
          version: 1,
          schemaVersion: 16,
          createdAt: '2026-10-11T00:00:00Z',
          tables: {
            synthetic: Array.from({ length: count }, (_, id) => ({
              id,
              characterId: 'benchmark',
              amount: 100000000,
              date: '2026-10-11',
              notes: 'Synthetic performance record'
            }))
          }
        })
        const service = new AutomaticBackupService(
          root,
          () => {
            exports++
            return content
          },
          undefined,
          undefined,
          () => 'unchanged'
        )
        for (let index = 0; index < 30; index++) expect(service.check(true).error).toBeNull()
        exports = 0
        const samples: number[] = []
        for (let index = 0; index < 20; index++) {
          const started = performance.now()
          expect(service.check().error).toBeNull()
          samples.push(performance.now() - started)
        }
        samples.sort((a, b) => a - b)
        console.log(
          JSON.stringify({
            benchmark: 'unchanged-backup-check',
            records: count,
            bytes: Buffer.byteLength(content),
            retainedBackups: 30,
            repetitions: 20,
            medianMs: Number(samples[10].toFixed(2)),
            p95Ms: Number(samples[18].toFixed(2)),
            exports
          })
        )
      } finally {
        const target = resolve(root)
        if (
          dirname(target) !== resolve(tmpdir()) ||
          !basename(target).startsWith('maple-backup-perf-')
        )
          throw new Error('Unsafe benchmark cleanup')
        rmSync(target, { recursive: true, force: true })
      }
    }
  },
  60000
)
