import type { NexonStatus, NexonRegistration } from '../../../shared/contracts/nexon.contract'
import { NexonClient } from '../../integrations/nexon/nexon.client'
import { CharacterRepository } from '../characters/character.repository'
import { CharacterService } from '../characters/character.service'

export class NexonService {
  constructor(
    private readonly client: NexonClient,
    private readonly configuration: NexonStatus,
    private readonly characters: CharacterRepository,
    private readonly characterService: CharacterService
  ) {}
  status(): NexonStatus {
    return { configured: this.configuration.configured, issue: this.configuration.issue }
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
}
