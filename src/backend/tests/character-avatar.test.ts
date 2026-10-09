import { describe, expect, it, vi } from 'vitest'
import { visibleImageBounds } from '../../shared/image-bounds'
import { CharacterAvatarService } from '../../desktop/main/character-avatar.service'
import type { Character } from '../../shared/contracts/character.contract'

function bitmap() {
  const pixels = Buffer.alloc(100 * 100 * 4)
  for (let y = 30; y <= 69; y++) for (let x = 10; x <= 29; x++) pixels[(y * 100 + x) * 4 + 3] = 255
  return pixels
}
const id = '11111111-1111-4111-8111-111111111111'
function fixture() {
  const character: Character = {
    id,
    name: '테스트',
    world: '레드',
    notes: '',

    createdAt: '',
    updatedAt: '',
    nexon: {
      ocid: 'test',
      profile: {
        level: 1,
        job: '',
        guild: '',
        fetchedAt: '2026-10-09',
        imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/test.png'
      }
    }
  }
  const crop = vi.fn(() => ({ toDataURL: () => 'data:image/png;base64,test' }))
  const decode = vi.fn(() => ({
    isEmpty: () => false,
    getSize: () => ({ width: 100, height: 100 }),
    toBitmap: bitmap,
    crop
  }))
  const transport = vi.fn<typeof fetch>(
    async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } })
  )
  return {
    character,
    crop,
    decode,
    transport,
    service: new CharacterAvatarService(() => character, decode, transport)
  }
}
describe('캐릭터 이미지 여백', () => {
  it('장비가 한쪽에 치우쳐도 원본 중심을 보존한다', () => {
    const pixels = bitmap()
    pixels[3] = 7 // 거의 투명한 배경은 제외한다.
    expect(visibleImageBounds(pixels, 100, 100)).toEqual({ x: 4, y: 4, width: 92, height: 92 })
    pixels[3] = 255 // 가장자리의 모자·무기도 포함한다.
    expect(visibleImageBounds(pixels, 100, 100)).toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })
  it('일반 외형은 같은 배율을 사용하고 큰 무기는 중심을 유지하며 범위를 넓힌다', () => {
    const pixels = Buffer.alloc(300 * 300 * 4)
    pixels[(130 * 300 + 140) * 4 + 3] = 255
    pixels[(200 * 300 + 160) * 4 + 3] = 255
    const standard = { x: 50, y: 50, width: 200, height: 200 }
    expect(visibleImageBounds(pixels, 300, 300)).toEqual(standard)
    pixels[(190 * 300 + 90) * 4 + 3] = 255
    expect(visibleImageBounds(pixels, 300, 300)).toEqual(standard)
    pixels[(190 * 300 + 220) * 4 + 3] = 255
    expect(visibleImageBounds(pixels, 300, 300)).toEqual(standard)
    pixels[(190 * 300 + 285) * 4 + 3] = 255
    expect(visibleImageBounds(pixels, 300, 300)).toEqual({ x: 8, y: 8, width: 284, height: 284 })
  })
  it('빈 이미지와 잘못된 비트맵은 표시하지 않는다', () => {
    expect(visibleImageBounds(Buffer.alloc(16), 2, 2)).toBeNull()
    expect(visibleImageBounds(Buffer.alloc(4), 2, 2)).toBeNull()
    expect(visibleImageBounds(Buffer.alloc(0), 0, 0)).toBeNull()
  })
  it('이미지를 자르고 중복 요청을 합치며 갱신 후 다시 읽는다', async () => {
    const { service, transport, crop, character } = fixture()
    const results = await Promise.all([service.get(id), service.get(id)])
    expect(results).toEqual(['data:image/png;base64,test', 'data:image/png;base64,test'])
    expect(crop).toHaveBeenCalledWith({ x: 4, y: 4, width: 92, height: 92 })
    await service.get(id)
    expect(transport).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0][1]?.redirect).toBe('error')
    character.nexon!.profile!.fetchedAt = '2026-10-10'
    await service.get(id)
    expect(transport).toHaveBeenCalledTimes(2)
  })
  it('수동 캐릭터나 허용하지 않은 URL은 요청하지 않는다', async () => {
    const { service, transport, character } = fixture()
    character.nexon!.profile!.imageUrl = 'https://example.com/image.png'
    expect(await service.get(id)).toBeNull()
    delete character.nexon
    expect(await service.get(id)).toBeNull()
    expect(transport).not.toHaveBeenCalled()
  })
  it('실패한 응답과 큰 파일은 디코딩하지 않고 대체 표시로 돌아간다', async () => {
    const { service, transport, decode } = fixture()
    transport.mockResolvedValueOnce(new Response('error', { status: 404 }))
    expect(await service.get(id)).toBeNull()
    transport.mockResolvedValueOnce(
      new Response('large', {
        headers: { 'content-type': 'image/png', 'content-length': '3000000' }
      })
    )
    expect(await service.get(id)).toBeNull()
    transport.mockResolvedValueOnce(
      new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
        headers: { 'content-type': 'image/png' }
      })
    )
    expect(await service.get(id)).toBeNull()
    expect(decode).not.toHaveBeenCalled()
    expect(await service.get(id)).toBe('data:image/png;base64,test')
  })
})
