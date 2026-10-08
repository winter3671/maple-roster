import {
  readOcidSelection,
  type NexonStatus,
  type NexonRegistration,
  type NexonBatchResult
} from '../../../shared/contracts/nexon.contract'
import { AppError } from '../../../shared/errors'
import { NexonClient } from '../../integrations/nexon/nexon.client'
import { CharacterRepository } from '../characters/character.repository'
import { CharacterService } from '../characters/character.service'
import type { NexonKeyStore } from '../../config/nexon-key-store'

export class NexonService {
  constructor(
    private readonly client: NexonClient,
    private readonly configuration: NexonStatus,
    private readonly characters: CharacterRepository,
    private readonly characterService: CharacterService,
    private readonly keyStore?: NexonKeyStore
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
    const existing = this.characters.findByIdentity(profile.name, profile.world)
    if (existing) return { character: existing, alreadyRegistered: true }
    return {
      character: this.characterService.create({
        name: profile.name,
        world: profile.world,
        notes: ''
      }),
      alreadyRegistered: false
    }
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
