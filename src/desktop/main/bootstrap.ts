import { getAppInfo } from '../../backend/modules/system/system.service'
import { openDatabase } from '../../backend/database/connection'
import { CharacterRepository } from '../../backend/modules/characters/character.repository'
import { CharacterService } from '../../backend/modules/characters/character.service'
import { HuntingRepository } from '../../backend/modules/hunting/hunting.repository'
import { HuntingService } from '../../backend/modules/hunting/hunting.service'
import { LedgerRepository } from '../../backend/modules/ledger/ledger.repository'
import { LedgerService } from '../../backend/modules/ledger/ledger.service'
import { UnitOfWork } from '../../backend/database/unit-of-work'

export function createServices(version: string, databasePath: string) {
  const database = openDatabase(databasePath)
  const characters = new CharacterRepository(database)
  const ledger = new LedgerRepository(database)
  return {
    system: { getInfo: () => getAppInfo(version) },
    characters: new CharacterService(characters),
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
