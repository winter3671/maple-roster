import {
  readOcidSelection,
  type NexonStatus,
  type NexonRegistration,
  type NexonBatchResult,
  type NexonProfile,
  type NexonSyncResult
} from '../../../shared/contracts/nexon.contract'
import { AppError } from '../../../shared/errors'
import { NexonClient } from '../../integrations/nexon/nexon.client'
import { CharacterRepository } from '../characters/character.repository'
import { CharacterService } from '../characters/character.service'
import type { NexonKeyStore } from '../../config/nexon-key-store'
import { UnitOfWork } from '../../database/unit-of-work'
import { readId, readObject } from '../../../shared/validation'
import type { Character } from '../../../shared/contracts/character.contract'

export class NexonService {
  private lastAutomaticAttempt = -Infinity
  constructor(
    private readonly client: NexonClient,
    private readonly configuration: NexonStatus,
    private readonly characters: CharacterRepository,
    private readonly characterService: CharacterService,
    private readonly keyStore: NexonKeyStore | undefined,
    private readonly transaction: UnitOfWork,
    private readonly now: () => Date = () => new Date()
  ) {}
  status(): NexonStatus {
    if (this.keyStore) return this.keyStore.status()
    return { configured: this.configuration.configured, issue: this.configuration.issue }
  }
  saveKey(value: unknown): NexonStatus {
    if (!this.keyStore)
      throw new AppError('API_KEY_STORAGE_ERROR', 'API 키 저장소를 사용할 수 없습니다.')
    return this.keyStore.save(value)
  }
  removeKey(): NexonStatus {
    if (!this.keyStore)
      throw new AppError('API_KEY_STORAGE_ERROR', 'API 키 저장소를 사용할 수 없습니다.')
    return this.keyStore.remove()
  }
  list() {
    return this.client.list()
  }
  basic(value: unknown) {
    return this.client.basic(value)
  }
  async register(value: unknown): Promise<NexonRegistration> {
    // Resolve the real name/world in the backend; do not trust renderer metadata.
    const profile = await this.client.basic(value)
    return this.transaction.run(() => {
      const existing =
        this.characters.findByOcid(profile.ocid) ??
        this.characters.findByIdentity(profile.name, profile.world)
      const character =
        existing ??
        this.characterService.create({ name: profile.name, world: profile.world, notes: '' })
      return {
        character: this.applyProfile(character, profile),
        alreadyRegistered: Boolean(existing)
      }
    })
  }
  private applyProfile(character: Character, profile: NexonProfile): Character {
    if (character.nexon && character.nexon.ocid !== profile.ocid)
      throw new AppError(
        'REQUEST_CONFLICT',
        '이 캐릭터는 다른 API 캐릭터와 연결되어 있습니다. 연결을 해제한 뒤 다시 등록하세요.'
      )
    const duplicate = this.characters.findByIdentity(profile.name, profile.world)
    if (duplicate && duplicate.id !== character.id)
      throw new AppError(
        'DUPLICATE_CHARACTER',
        '최신 이름과 서버가 다른 등록 캐릭터와 겹칩니다. 기존 설정을 확인해 주세요.'
      )
    this.characters.saveProfile(character.id, { ...profile, fetchedAt: this.now().toISOString() })
    return this.characters.find(character.id)!
  }
  unlink(value: unknown): Character {
    const id = readId(value)
    return this.transaction.run(() => {
      if (!this.characters.find(id))
        throw new AppError('CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.')
      this.characters.unlink(id)
      return this.characters.find(id)!
    })
  }
  async syncProfiles(value: unknown): Promise<NexonSyncResult> {
    const input = readObject(value)
    if (typeof input.force !== 'boolean')
      throw new AppError('VALIDATION_ERROR', '갱신 방식을 확인해 주세요.')
    let selected: Set<string> | undefined
    if (input.characterIds !== undefined) {
      if (
        !Array.isArray(input.characterIds) ||
        input.characterIds.length < 1 ||
        input.characterIds.length > 500
      )
        throw new AppError('VALIDATION_ERROR', '갱신할 캐릭터를 1~500개 선택해 주세요.')
      selected = new Set(input.characterIds.map(readId))
    }
    const all = this.characters.list()
    if (selected && [...selected].some((id) => !all.some((row) => row.id === id && row.nexon)))
      throw new AppError('VALIDATION_ERROR', 'API에 연결된 캐릭터를 선택해 주세요.')
    const timestamp = this.now().getTime()
    if (!input.force) {
      if (!this.status().configured || timestamp - this.lastAutomaticAttempt < 5 * 60 * 1000)
        return { items: [] }
      this.lastAutomaticAttempt = timestamp
    }
    const candidates = all.filter(
      (row) =>
        row.nexon &&
        (selected ? selected.has(row.id) : !row.isHidden) &&
        (input.force ||
          !row.nexon.profile ||
          timestamp - Date.parse(row.nexon.profile.fetchedAt) >= 24 * 60 * 60 * 1000)
    )
    const items: NexonSyncResult['items'] = []
    let interruption: { code: AppError['code']; message: string } | undefined
    for (const character of candidates) {
      if (interruption) {
        items.push({ characterId: character.id, status: 'notAttempted', error: interruption })
        continue
      }
      try {
        const profile = await this.client.basic(character.nexon!.ocid)
        this.transaction.run(() => {
          const current = this.characters.find(character.id)
          if (!current || current.nexon?.ocid !== character.nexon!.ocid)
            throw new AppError(
              'REQUEST_CONFLICT',
              '조회 중 API 연결이 변경되었습니다. 다시 갱신해 주세요.'
            )
          this.applyProfile(current, profile)
        })
        items.push({ characterId: character.id, status: 'updated' })
      } catch (caught) {
        const error =
          caught instanceof AppError
            ? { code: caught.code, message: caught.message }
            : {
                code: 'DATABASE_ERROR' as const,
                message: '프로필을 저장하지 못했습니다. 기존 기록은 유지됩니다.'
              }
        items.push({ characterId: character.id, status: 'failed', error })
        if (
          [
            'API_KEY_MISSING',
            'API_KEY_INVALID',
            'API_PERMISSION_DENIED',
            'API_RATE_LIMITED',
            'API_NETWORK_ERROR'
          ].includes(error.code)
        )
          interruption = error
      }
    }
    return { items }
  }
  async registerMany(value: unknown): Promise<NexonBatchResult> {
    const ids = readOcidSelection(value)
    const items: NexonBatchResult['items'] = []
    let interruption: { code: AppError['code']; message: string } | undefined
    for (const ocid of ids) {
      if (interruption) {
        items.push({ ocid, status: 'notAttempted', error: interruption })
        continue
      }
      try {
        const result = await this.register(ocid)
        items.push({
          ocid,
          status: result.alreadyRegistered ? 'existing' : 'created',
          character: result.character
        })
      } catch (caught) {
        const error =
          caught instanceof AppError
            ? { code: caught.code, message: caught.message }
            : {
                code: 'DATABASE_ERROR' as const,
                message: '캐릭터를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
              }
        items.push({ ocid, status: 'failed', error })
        if (
          [
            'API_KEY_MISSING',
            'API_KEY_INVALID',
            'API_PERMISSION_DENIED',
            'API_RATE_LIMITED',
            'API_NETWORK_ERROR'
          ].includes(error.code)
        )
          interruption = error
      }
    }
    return { items }
  }
}
