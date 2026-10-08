import { AppError } from '../../../shared/errors'
import {
  readOcid,
  type NexonCharacter,
  type NexonProfile
} from '../../../shared/contracts/nexon.contract'

function invalid(): never {
  throw new AppError(
    'API_RESPONSE_INVALID',
    '넥슨 응답 형식을 확인하지 못했습니다. 잠시 후 다시 조회해 주세요.'
  )
}
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, max = 500, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) return invalid()
  return value.trim()
}
function character(value: unknown, ocid?: string): NexonCharacter {
  const row = object(value)
  const identifier = text(ocid ?? row.ocid, 128)
  try {
    readOcid(identifier)
  } catch {
    return invalid()
  }
  if (
    !Number.isSafeInteger(row.character_level) ||
    Number(row.character_level) < 1 ||
    Number(row.character_level) > 1000
  )
    return invalid()
  return {
    ocid: identifier,
    name: text(row.character_name, 40),
    world: text(row.world_name, 40),
    job: text(row.character_class, 80),
    level: Number(row.character_level)
  }
}

export class NexonClient {
  private queue: Promise<void> = Promise.resolve()
  private nextRequestAt = 0
  constructor(
    private readonly getKey: () => string | undefined,
    private readonly transport: typeof fetch = fetch,
    private readonly spacingMs = 300
  ) {}

  async list(): Promise<NexonCharacter[]> {
    const body = object(await this.request('character/list'))
    if (!Array.isArray(body.account_list)) return invalid()
    const seen = new Set<string>()
    const result: NexonCharacter[] = []
    for (const account of body.account_list) {
      const rows = object(account).character_list
      if (!Array.isArray(rows)) return invalid()
      for (const row of rows) {
        const entry = character(row)
        if (!seen.has(entry.ocid)) {
          seen.add(entry.ocid)
          result.push(entry)
        }
      }
    }
    return result.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'ko'))
  }

  async basic(value: unknown): Promise<NexonProfile> {
    const ocid = readOcid(value)
    const row = object(await this.request('character/basic', { ocid }))
    return {
      ...character(row, ocid),
      guild: row.character_guild_name === null ? '' : text(row.character_guild_name, 100, true),
      fetchedAt: new Date().toISOString()
    }
  }

  private request(
    endpoint: 'character/list' | 'character/basic',
    params: Record<string, string> = {}
  ): Promise<unknown> {
    const task = this.queue.then(async () => {
      const key = this.getKey()
      if (!key)
        throw new AppError(
          'API_KEY_MISSING',
          '프로젝트의 .env에 NEXON_API_KEY를 입력하고 앱을 다시 실행해 주세요.'
        )
      const delay = this.nextRequestAt - Date.now()
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
      this.nextRequestAt = Date.now() + this.spacingMs
      const url = new URL(`https://open.api.nexon.com/maplestory/v1/${endpoint}`)
      url.search = new URLSearchParams(params).toString()
      let response: Response
      let body: unknown
      try {
        response = await this.transport(url, {
          headers: { 'x-nxopen-api-key': key },
          signal: AbortSignal.timeout(10000),
          redirect: 'error'
        })
        try {
          body = await response.json()
        } catch {
          body = null
        }
      } catch {
        throw new AppError(
          'API_NETWORK_ERROR',
          '넥슨 API에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 조회해 주세요.'
        )
      }
      if (!response.ok) {
        const code =
          typeof body === 'object' && body !== null && 'error' in body
            ? (body as { error?: { name?: unknown } }).error?.name
            : undefined
        if (code === 'OPENAPI00005' || response.status === 401)
          throw new AppError(
            'API_KEY_INVALID',
            'API 키가 유효하지 않습니다. 메이플스토리용 키인지 확인해 주세요.'
          )
        if (code === 'OPENAPI00002' || response.status === 403)
          throw new AppError(
            'API_PERMISSION_DENIED',
            '조회 권한이 없습니다. 본인 계정용 키와 캐릭터 목록 정보 활용 동의를 확인해 주세요.'
          )
        if (code === 'OPENAPI00007' || response.status === 429) {
          this.nextRequestAt = Date.now() + 5000
          throw new AppError(
            'API_RATE_LIMITED',
            'API 호출 한도를 초과했습니다. 잠시 후 다시 조회해 주세요.'
          )
        }
        throw new AppError(
          'API_UNAVAILABLE',
          '넥슨에서 데이터를 제공하지 못했습니다. 데이터 준비 상태나 점검 여부를 확인한 뒤 다시 조회해 주세요.'
        )
      }
      if (body === null) return invalid()
      return body
    })
    this.queue = task.then(
      () => undefined,
      () => undefined
    )
    return task
  }
}
