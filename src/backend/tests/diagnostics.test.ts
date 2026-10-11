import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, dirname, basename, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  DiagnosticLog,
  diagnosticCode,
  recordDiagnostic,
  recordRequestResult,
  setDiagnosticRecorder,
  type DiagnosticEvent
} from '../../desktop/main/diagnostics'

const directories: string[] = []
const metadata = {
  appVersion: '0.2.5',
  electronVersion: '44.6.0',
  nodeVersion: '24.0.0',
  platform: 'win32'
}
async function fixture(limit?: number) {
  const directory = await mkdtemp(join(tmpdir(), 'maple-diagnostics-test-'))
  directories.push(directory)
  return {
    directory,
    log: new DiagnosticLog(directory, metadata, limit),
    output: join(directory, 'export.json')
  }
}
afterEach(async () => {
  setDiagnosticRecorder()
  for (const directory of directories.splice(0)) {
    if (
      dirname(resolve(directory)) !== resolve(tmpdir()) ||
      !basename(directory).startsWith('maple-diagnostics-test-')
    )
      throw Error('임시 경로 검증 실패')
    await rm(directory, { recursive: true, force: true })
  }
})
describe('개인정보 없는 진단 로그', () => {
  it('허용한 코드·작업·시간만 기록하고 키·입력·경로·원본 오류를 제외한다', async () => {
    const { log, directory, output } = await fixture()
    const sensitive = 'synthetic-private-marker'
    log.record({
      event: 'request.failed',
      operation: 'nexon:save-key',
      code: 'API_KEY_INVALID',
      durationMs: 12.6,
      key: sensitive,
      input: { name: sensitive },
      message: sensitive,
      stack: sensitive,
      filePath: sensitive
    } as DiagnosticEvent)
    await log.flush()
    const raw = await readFile(join(directory, 'diagnostics.jsonl'), 'utf8')
    expect(raw).not.toContain(sensitive)
    expect(JSON.parse(raw)).toMatchObject({
      event: 'request.failed',
      operation: 'nexon:save-key',
      code: 'API_KEY_INVALID',
      durationMs: 13,
      appVersion: '0.2.5'
    })
    expect(await log.exportFile(output)).toBe(1)
    expect(await readFile(output, 'utf8')).not.toContain(sensitive)
  })
  it('알 수 없는 코드와 작업 이름을 원문으로 남기지 않고 숫자도 제한한다', async () => {
    const { log, output } = await fixture()
    log.record({
      event: 'request.failed',
      operation: 'synthetic-private-operation',
      code: 'synthetic-private-code',
      reason: 'synthetic-private-reason',
      durationMs: Infinity,
      failed: -1
    })
    await log.exportFile(output)
    const result = JSON.parse(await readFile(output, 'utf8')).entries[0]
    expect(result.code).toBe('UNEXPECTED_ERROR')
    expect(result.operation).toBeUndefined()
    expect(result.reason).toBeUndefined()
    expect(result.durationMs).toBeUndefined()
    expect(result.failed).toBeUndefined()
  })
  it('공유 전에 다시 검증하여 외부에서 수정된 로그의 추가 정보도 제외한다', async () => {
    const { log, directory, output } = await fixture()
    await log.flush()
    await writeFile(
      join(directory, 'diagnostics.jsonl'),
      JSON.stringify({
        at: '2026-10-11T00:00:00.000Z',
        event: 'app.failed',
        operation: 'startup',
        appVersion: 'synthetic-private-version',
        message: 'synthetic-private-message'
      }) +
        '\nnot-json\n' +
        JSON.stringify({ at: 'synthetic-private-date', event: 'app.failed' })
    )
    await log.exportFile(output)
    const text = await readFile(output, 'utf8')
    expect(text).not.toContain('synthetic-private')
    expect(JSON.parse(text).entries).toHaveLength(1)
  })
  it('파일은 지정 크기를 넘지 않고 오래된 기록을 최근 3개로 순환한다', async () => {
    const { log, directory, output } = await fixture(350)
    for (let n = 0; n < 20; n++) {
      log.record({ event: 'request.slow', operation: 'ledger:page', durationMs: 2000 + n })
      await log.flush()
    }
    const files = (await readdir(directory)).filter((name) => name.endsWith('.jsonl'))
    expect(files).toHaveLength(3)
    for (const file of files)
      expect((await stat(join(directory, file))).size).toBeLessThanOrEqual(350)
    await log.exportFile(output)
    const rows = JSON.parse(await readFile(output, 'utf8')).entries
    expect(rows.at(-1).durationMs).toBe(2019)
    expect(rows[0].durationMs).toBeGreaterThan(2000)
    expect(rows.map((row: { durationMs: number }) => row.durationMs)).toEqual(
      [...rows.map((row: { durationMs: number }) => row.durationMs)].sort(
        (a: number, b: number) => a - b
      )
    )
  })
  it('연속 오류의 메모리 대기열을 제한한다', async () => {
    const { log } = await fixture()
    for (let n = 0; n < 200; n++) log.record({ event: 'app.failed', operation: 'startup' })
    expect(await log.status()).toMatchObject({ dropped: 136, writeIssue: false })
  })
  it('재실행 후에도 기존 파일 크기를 반영해 순환을 이어간다', async () => {
    const { log, directory } = await fixture(350)
    log.record({ event: 'app.started', operation: 'startup' })
    await log.flush()
    const resumed = new DiagnosticLog(directory, metadata, 350)
    for (let n = 0; n < 10; n++) {
      resumed.record({ event: 'app.started', operation: 'startup' })
      await resumed.flush()
    }
    expect((await resumed.status()).files).toBe(3)
    for (const name of await readdir(directory))
      expect((await stat(join(directory, name))).size).toBeLessThanOrEqual(350)
  })
  it('저장 위치에 쓸 수 없어도 기록 호출은 실패하지 않는다', async () => {
    const { directory } = await fixture()
    const blocked = join(directory, 'blocked')
    await writeFile(blocked, 'test')
    const log = new DiagnosticLog(blocked, metadata)
    expect(() => log.record({ event: 'app.failed', operation: 'startup' })).not.toThrow()
    expect(await log.status()).toMatchObject({ files: 0, writeIssue: true })
  })
  it('내보내기 실패 후에도 다음 진단 기록을 저장한다', async () => {
    const { log, directory } = await fixture()
    await expect(log.exportFile(join(directory, 'missing', 'export.json'))).rejects.toThrow()
    log.record({ event: 'app.failed', operation: 'startup' })
    expect(await log.status()).toMatchObject({ files: 1, writeIssue: false })
  })
  it('외부에서 커진 파일도 제한된 크기만 읽고 원문을 반환하지 않는다', async () => {
    const { log, directory, output } = await fixture(350)
    await log.flush()
    await writeFile(join(directory, 'diagnostics.jsonl'), 'synthetic-private'.repeat(10000))
    expect(await log.exportFile(output)).toBe(0)
    expect((await stat(output)).size).toBeLessThan(1000)
  })
  it('내보내기를 파일 회전과 직렬 처리하여 진단 기록이 중복되지 않는다', async () => {
    const { log, output } = await fixture(350)
    log.record({ event: 'request.slow', operation: 'ledger:page', durationMs: 2001 })
    const exporting = log.exportFile(output)
    log.record({ event: 'request.slow', operation: 'ledger:page', durationMs: 2002 })
    expect(await exporting).toBe(1)
    expect(
      JSON.parse(await readFile(output, 'utf8')).entries.map(
        (row: { durationMs: number }) => row.durationMs
      )
    ).toEqual([2001])
    await log.flush()
  })
  it('로깅 대상은 일부 실패의 코드·개수이며 정상 주기 조회는 기록하지 않는다', () => {
    const rows: DiagnosticEvent[] = []
    setDiagnosticRecorder((row) => rows.push(row))
    recordRequestResult('updates:status', { message: 'synthetic-private' }, 10)
    expect(rows).toHaveLength(0)
    recordRequestResult(
      'nexon:sync-profiles',
      {
        items: [
          { status: 'updated' },
          { status: 'failed', error: { code: 'API_RATE_LIMITED', message: 'synthetic-private' } }
        ]
      },
      2100
    )
    expect(rows).toEqual([
      { event: 'request.slow', operation: 'nexon:sync-profiles', durationMs: 2100 },
      {
        event: 'request.partial',
        operation: 'nexon:sync-profiles',
        code: 'API_RATE_LIMITED',
        failed: 1,
        durationMs: 2100
      }
    ])
    expect(JSON.stringify(rows)).not.toContain('synthetic-private')
  })
  it('기록기 예외와 비정상 오류 객체가 사용자 작업을 방해하지 않는다', () => {
    setDiagnosticRecorder(() => {
      throw Error('synthetic-private')
    })
    expect(() => recordDiagnostic({ event: 'app.failed' })).not.toThrow()
    expect(
      diagnosticCode({
        get code() {
          throw Error('synthetic-private')
        }
      })
    ).toBe('UNEXPECTED_ERROR')
    expect(diagnosticCode({ code: 'ENOSPC' })).toBe('ENOSPC')
  })
})
