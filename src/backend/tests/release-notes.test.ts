import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('../../../scripts/release-notes.mjs', import.meta.url))
describe('릴리스 게시 전 작성 내역 검사', () => {
  it('현재 배포 버전의 내역을 GitHub용 Markdown으로 출력한다', () => {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('# Maple Roster v')
    expect(result.stdout).toMatch(/\n- .+/)
  })
  it('내역이 없는 버전은 게시 실패로 끝내고 본문을 생성하지 않는다', () => {
    const result = spawnSync(process.execPath, [script, '999999.0.0'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Release notes are missing')
  })
})
