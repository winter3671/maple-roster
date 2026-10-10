import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('../../../scripts/release-notes.mjs', import.meta.url))
describe('릴리스 게시 전 작성 내역 검사', () => {
  it('확정된 v0.2.1 내역을 기능별 GitHub Markdown으로 출력한다', () => {
    const result = spawnSync(process.execPath, [script, '0.2.1'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('# Maple Roster v')
    expect(result.stdout).toMatch(/\n- .+/)
    expect(result.stdout).toContain('## 캐릭터 관리\n\n- ')
    expect(result.stdout).toContain('## 주간 콘텐츠\n\n- ')
    expect(result.stdout).toContain('## 보스 장부\n\n- ')
    expect(result.stdout).toContain('## 대시보드 수익 집계\n\n- ')
    expect(result.stdout).toContain('## 지출 관리\n\n- ')
    expect(result.stdout).toContain('## 앱 업데이트와 실행\n\n- ')
  })
  it('기존 버전의 단순 목록도 그대로 출력한다', () => {
    const result = spawnSync(process.execPath, [script, '0.2.0'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('# Maple Roster v0.2.0')
    expect(result.stdout).toContain('\n- 캐릭터 수동 등록')
    expect(result.stdout).not.toContain('\n## ')
  })
  it('내역이 없는 버전은 게시 실패로 끝내고 본문을 생성하지 않는다', () => {
    const result = spawnSync(process.execPath, [script, '999999.0.0'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Release notes are missing')
  })
})
