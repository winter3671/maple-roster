import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
    'run',
    '--disableConsoleIntercept',
    'src/backend/tests/ledger.performance.test.ts'
  ],
  { stdio: 'inherit', env: { ...process.env, MAPLE_RUN_LEDGER_PERF: '1' } }
)
if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1
