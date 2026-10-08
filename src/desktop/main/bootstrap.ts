import { getAppInfo } from '../../backend/modules/system/system.service'
import { openDatabase } from '../../backend/database/connection'
import { CharacterRepository } from '../../backend/modules/characters/character.repository'
import { CharacterService } from '../../backend/modules/characters/character.service'
import { HuntingRepository } from '../../backend/modules/hunting/hunting.repository'
import { HuntingService } from '../../backend/modules/hunting/hunting.service'
import { LedgerRepository } from '../../backend/modules/ledger/ledger.repository'
import { LedgerService } from '../../backend/modules/ledger/ledger.service'
import { UnitOfWork } from '../../backend/database/unit-of-work'
import type { NexonKeyConfig } from '../../backend/config/nexon-key'
import { NexonClient } from '../../backend/integrations/nexon/nexon.client'
import { NexonService } from '../../backend/modules/nexon/nexon.service'
import { BossRepository } from '../../backend/modules/bosses/boss.repository'
import { BossService } from '../../backend/modules/bosses/boss.service'

export function createServices(
  version: string,
  databasePath: string,
  nexonKey: NexonKeyConfig = { configured: false, issue: 'missing' }
) {
  const database = openDatabase(databasePath)
  const characters = new CharacterRepository(database)
  const ledger = new LedgerRepository(database)
  const characterService = new CharacterService(characters)
  return {
    system: { getInfo: () => getAppInfo(version) },
    characters: characterService,
    bosses: new BossService(
      new BossRepository(database),
      characters,
      ledger,
      new UnitOfWork(database)
    ),
    nexon: new NexonService(
      new NexonClient(() => nexonKey.key),
      nexonKey,
      characters,
      characterService
    ),
    hunting: new HuntingService(
      new HuntingRepository(database),
      characters,
      ledger,
      new UnitOfWork(database)
    ),
    ledger: new LedgerService(ledger),
    close: () => database.close()
  }
}

export type Services = ReturnType<typeof createServices>
