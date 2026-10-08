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
import type { NexonKeyStore } from '../../backend/config/nexon-key-store'
import { NexonClient } from '../../backend/integrations/nexon/nexon.client'
import { NexonService } from '../../backend/modules/nexon/nexon.service'
import { BossRepository } from '../../backend/modules/bosses/boss.repository'
import { BossService } from '../../backend/modules/bosses/boss.service'
import { BossSyncService } from '../../backend/modules/bosses/boss-sync.service'
import { BossRosterService } from '../../backend/modules/bosses/boss-roster.service'
import { DropRepository } from '../../backend/modules/drops/drop.repository'
import { DropService } from '../../backend/modules/drops/drop.service'
import { dirname, join } from 'node:path'
import { BackupService } from '../../backend/modules/backup/backup.service'
import { saveRecoveryBackup } from '../../backend/modules/backup/backup.files'
import { CrystalPriceService } from '../../backend/modules/prices/crystal-price.service'

export function createServices(
  version: string,
  databasePath: string,
  nexonKey: NexonKeyConfig = { configured: false, issue: 'missing' },
  keyStore?: NexonKeyStore
) {
  const database = openDatabase(databasePath)
  const characters = new CharacterRepository(database)
  const ledger = new LedgerRepository(database)
  const drops = new DropRepository(database)
  const hunting = new HuntingRepository(database)
  const bosses = new BossRepository(database)
  const transactions = new UnitOfWork(database)
  const characterService = new CharacterService(characters)
  const nexonClient = new NexonClient(() => (keyStore ? keyStore.getKey() : nexonKey.key))
  const prices = new CrystalPriceService(database)
  const history = () => prices.custom()
  const bossService = new BossService(
    bosses,
    characters,
    ledger,
    transactions,
    drops,
    undefined,
    history
  )
  return {
    prices,
    backup: new BackupService(database, (content) =>
      saveRecoveryBackup(join(dirname(databasePath), '..', 'backups'), content)
    ),
    system: { getInfo: () => getAppInfo(version) },
    characters: characterService,
    bosses: bossService,
    bossSync: new BossSyncService(nexonClient, characters, bossService, undefined, history),
    bossRosters: new BossRosterService(
      database,
      bosses,
      characters,
      transactions,
      undefined,
      history
    ),
    nexon: new NexonService(
      nexonClient,
      nexonKey,
      characters,
      characterService,
      keyStore,
      transactions
    ),
    hunting: new HuntingService(hunting, characters, ledger, transactions, drops),
    drops: new DropService(drops, hunting, bosses, ledger, transactions),
    ledger: new LedgerService(ledger),
    close: () => database.close()
  }
}

export type Services = ReturnType<typeof createServices>
