import { describe, expect, it, vi } from 'vitest'
import { NexonClient } from '../integrations/nexon/nexon.client'
import { WeeklyService } from '../modules/weekly/weekly.service'
import { guildContent } from '../../shared/weekly-content'
import type { Character } from '../../shared/contracts/character.contract'
import { AppError } from '../../shared/errors'

const contents = [
  { name: '[길드] 지하 수로', count: 15384, maximum: 0 },
  { name: '[길드] 플래그 레이스', count: 0, maximum: 0 }
]
function character(id: string, connected = true): Character {
  return {
    id,
    name: id,
    world: '레드',
    notes: '',
    isHidden: false,
    createdAt: '',
    updatedAt: '',
    ...(connected ? { nexon: { ocid: id, profile: null } } : {})
  }
}
describe('이번 주 콘텐츠', () => {
  it('공백이 다른 길드 콘텐츠 이름에서도 점수를 찾고 누락 항목을 구분한다', () => {
    expect(guildContent(contents, 'suro')?.count).toBe(15384)
    expect(guildContent(contents, 'flag')?.count).toBe(0)
    expect(guildContent([], 'suro')).toBeUndefined()
  })
  it('실시간 API 수치를 읽고 스케줄러 즐겨찾기 여부를 참여로 해석하지 않는다', async () => {
    const transport = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            date: '2026-10-09T21:00+09:00',
            weekly_contents: contents.map((content) => ({
              content_name: content.name,
              now_count: content.count,
              max_count: content.maximum,
              registration_flag: 'false'
            }))
          })
        )
    )
    const client = new NexonClient(() => 'test-key', transport, 0)
    expect(await client.weeklyContents('test-ocid', '2026-10-09')).toEqual(contents)
    const url = new URL(String(transport.mock.calls[0][0]))
    expect(url.pathname).toBe('/maplestory/v1/scheduler/character-state')
    expect(url.searchParams.has('date')).toBe(false)
  })
  it('오래된 응답과 잘못된 수행 수치를 미참여로 바꾸지 않는다', async () => {
    for (const body of [
      { date: '2026-10-08', weekly_contents: [] },
      {
        date: '2026-10-09',
        weekly_contents: [{ content_name: '[길드] 지하 수로', now_count: -1, max_count: 0 }]
      },
      { date: '2026-10-09', weekly_contents: null }
    ]) {
      const client = new NexonClient(
        () => 'test-key',
        async () => new Response(JSON.stringify(body)),
        0
      )
      await expect(client.weeklyContents('test', '2026-10-09')).rejects.toMatchObject({
        code: 'API_RESPONSE_INVALID'
      })
    }
  })
  it('목요일 00시에 지난 주 점수를 지우고 연결 변경·삭제 캐릭터의 결과를 재사용하지 않는다', async () => {
    let now = new Date('2026-10-14T14:59:59Z')
    let characters = [character('a'), character('manual', false)]
    const client = { weeklyContents: vi.fn(async () => contents) }
    const service = new WeeklyService(client, { list: () => characters }, () => now)
    const result = await service.sync()
    expect(result.week).toBe('2026-10-08')
    expect(result.characters[0].contents).toEqual(contents)
    expect(client.weeklyContents).toHaveBeenCalledTimes(1)
    now = new Date('2026-10-14T15:00:00Z')
    expect(service.list().week).toBe('2026-10-15')
    expect(service.list().characters[0].contents).toBeUndefined()
    await service.sync()
    characters[0].nexon!.ocid = 'different'
    expect(service.list().characters[0].contents).toBeUndefined()
    characters = []
    expect(service.list().characters).toEqual([])
  })
  it('개별 실패는 확인 불가로 남기고 다른 캐릭터도 조회한다', async () => {
    const client = {
      weeklyContents: vi.fn(async (id: unknown) => {
        if (id === 'a') throw new AppError('API_RESPONSE_INVALID', '응답 없음')
        return contents
      })
    }
    const service = new WeeklyService(client, { list: () => [character('a'), character('b')] })
    const result = await service.sync()
    expect(result.characters[0].error).toBe('응답 없음')
    expect(result.characters[0].contents).toBeUndefined()
    expect(result.characters[1].contents).toEqual(contents)
  })
  it('중복 새로고침을 합치고 API 키·호출 제한 오류는 후속 호출을 멈춘다', async () => {
    const client = {
      weeklyContents: vi.fn(async () => {
        throw new AppError('API_RATE_LIMITED', '호출 제한')
      })
    }
    const service = new WeeklyService(client, { list: () => [character('a'), character('b')] })
    const [first, second] = await Promise.all([service.sync(), service.sync()])
    expect(first).toEqual(second)
    expect(client.weeklyContents).toHaveBeenCalledTimes(1)
    expect(first.characters[1].error).toContain('미조회')
  })
  it('조회 중 목요일로 넘어가도 이전 주 결과를 이번 주로 저장하지 않는다', async () => {
    let now = new Date('2026-10-14T14:59:59Z')
    const service = new WeeklyService(
      {
        weeklyContents: async () => {
          now = new Date('2026-10-14T15:00:00Z')
          return contents
        }
      },
      { list: () => [character('a')] },
      () => now
    )
    const result = await service.sync()
    expect(result.week).toBe('2026-10-15')
    expect(result.characters[0].contents).toBeUndefined()
  })
})
