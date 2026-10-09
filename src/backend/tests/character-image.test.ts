import { describe, expect, it } from 'vitest'
import { characterImageUrl, MAX_CHARACTER_IMAGE_URL_LENGTH } from '../../shared/character-image'

const prefix = 'https://open.api.nexon.com/static/maplestory/character/look/'
describe('넥슨 캐릭터 외형 URL', () => {
  it('실제 응답처럼 1000자를 넘는 외형 URL과 공식 쿼리를 유지한다', () => {
    const value = prefix + 'A'.repeat(2048) + '?wmotion=W00'
    expect(characterImageUrl(value)).toBe(value)
  })
  it('허용 길이 경계까지 지원하고 초과 URL은 제외한다', () => {
    const boundary = prefix + 'A'.repeat(MAX_CHARACTER_IMAGE_URL_LENGTH - prefix.length)
    expect(characterImageUrl(boundary)).toBe(boundary)
    expect(characterImageUrl(boundary + 'A')).toBeNull()
    expect(characterImageUrl(prefix + '가'.repeat(2000))).toBeNull()
  })
  it('외부 서버·API 경로·자격 증명·비 HTTPS 주소는 허용하지 않는다', () => {
    for (const value of [
      'https://example.com/avatar',
      prefix.replace('https:', 'http:') + 'A',
      prefix.replace('open.api.nexon.com', 'open.api.nexon.com.example.com') + 'A',
      prefix.replace('https://', 'https://user:password@') + 'A',
      'https://open.api.nexon.com/maplestory/v1/character/basic',
      null,
      undefined
    ])
      expect(characterImageUrl(value)).toBeNull()
  })
})
