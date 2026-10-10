import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BOSS_ICON_MANIFEST } from '../../shared/boss-icon-manifest'
import { WEEKLY_BOSSES, MONTHLY_BOSSES } from '../../shared/boss-catalog'

describe('보스 캡처 아이콘', () => {
  it('주간·월간 보스의 모든 조합에 한 파일을 연결한다', () => {
    const expected = [...WEEKLY_BOSSES, ...MONTHLY_BOSSES]
      .flatMap((b) => b.difficulties.map((d) => JSON.stringify([b.name, d])))
      .sort()
    const actual = BOSS_ICON_MANIFEST.map((b) => JSON.stringify([b.bossName, b.difficulty])).sort()
    expect(actual).toEqual(expected)
    expect(new Set(BOSS_ICON_MANIFEST.map((b) => b.file)).size).toBe(actual.length)
  })
  it('각 PNG는 명시한 원본 크기이며 고아 파일을 남기지 않는다', () => {
    const directory = resolve('src/frontend/assets/bosses')
    expect(readdirSync(directory).sort()).toEqual(BOSS_ICON_MANIFEST.map((b) => b.file).sort())
    for (const entry of BOSS_ICON_MANIFEST) {
      const png = readFileSync(resolve(directory, entry.file))
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(png.readUInt32BE(16)).toBe(entry.width)
      expect(png.readUInt32BE(20)).toBe(entry.height)
    }
  })
})
