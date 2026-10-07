import { getAppInfo } from '../../backend/modules/system/system.service'
import { openDatabase } from '../../backend/database/connection'
import { CharacterRepository } from '../../backend/modules/characters/character.repository'
import { CharacterService } from '../../backend/modules/characters/character.service'

export function createServices(version: string, databasePath: string) {
  const database = openDatabase(databasePath)
  return {
    system: { getInfo: () => getAppInfo(version) },
    characters: new CharacterService(new CharacterRepository(database)),
    close: () => database.close()
  }
}

export type Services = ReturnType<typeof createServices>
