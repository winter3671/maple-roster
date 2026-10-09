import type {
  Character,
  CharacterInput,
  CharacterUpdate,
  CharacterVisibility
} from './character.contract'
import type { ApiResult } from '../errors'
import type { WeeklyOverview } from './weekly.contract'
import type { DashboardStats } from './dashboard.contract'
import type { CrystalPriceEntry, CrystalPriceInput } from './crystal-price.contract'
import type { CsvSaved } from './csv.contract'
import type {
  BackupPreview,
  BackupSaved,
  BackupRestored,
  AutomaticBackupStatus
} from './backup.contract'
import type {
  BossSyncPreview,
  BossSyncApply,
  BossSyncApplyResult,
  BossBatchSyncResult
} from './boss-sync.contract'
import type {
  BossDropBatchCreate,
  HuntingDropSaleState,
  DropSource,
  DropList,
  DropLot,
  DropLotCreate,
  DropLotUpdate,
  DropSale,
  DropSaleCreate,
  DropSaleUpdate
} from './drop.contract'
import type { HuntingCreate, HuntingUpdate, HuntingSession, HuntingList } from './hunting.contract'
import type { LedgerList, RecordQuery } from './ledger.contract'
import type {
  BossList,
  BossQuery,
  BossRun,
  BossRunUpdate,
  BossIncomeDateUpdate,
  BossRunCreate,
  CrystalInput
} from './boss.contract'
import type {
  NexonStatus,
  NexonCharacter,
  NexonProfile,
  NexonRegistration,
  NexonBatchResult,
  NexonSyncResult
} from './nexon.contract'

import type { Expense, ExpenseCreate, ExpenseUpdate } from './expense.contract'
import type { UpdateStatus } from './update.contract'

export interface AppInfo {
  name: string
  version: string
  stage: 'hunting-ledger'
}

export interface AppApi {
  updates: {
    status: () => Promise<ApiResult<UpdateStatus>>
    check: () => Promise<ApiResult<UpdateStatus>>
    download: () => Promise<ApiResult<UpdateStatus>>
    install: () => Promise<ApiResult<UpdateStatus>>
  }
  prices: {
    list: () => Promise<ApiResult<CrystalPriceEntry[]>>
    save: (input: CrystalPriceInput) => Promise<ApiResult<CrystalPriceEntry[]>>
    remove: (id: string) => Promise<ApiResult<CrystalPriceEntry[]>>
  }
  dashboard: { summary: (query: RecordQuery) => Promise<ApiResult<DashboardStats>> }
  backup: {
    automaticStatus: () => Promise<ApiResult<AutomaticBackupStatus>>
    automaticNow: () => Promise<ApiResult<AutomaticBackupStatus>>
    exportFile: () => Promise<ApiResult<BackupSaved | null>>
    selectFile: () => Promise<ApiResult<BackupPreview | null>>
    restore: (previewId: string) => Promise<ApiResult<BackupRestored>>
    cancel: () => Promise<ApiResult<null>>
  }
  weekly: {
    list: () => Promise<ApiResult<WeeklyOverview>>
    sync: () => Promise<ApiResult<WeeklyOverview>>
  }
  drops: {
    setHuntingSale: (input: HuntingDropSaleState) => Promise<ApiResult<DropSale | null>>
    createBossLots: (input: BossDropBatchCreate) => Promise<ApiResult<DropLot[]>>
    list: (source: DropSource) => Promise<ApiResult<DropList>>
    createLot: (input: DropLotCreate) => Promise<ApiResult<DropLot>>
    updateLot: (input: DropLotUpdate) => Promise<ApiResult<DropLot>>
    removeLot: (id: string) => Promise<ApiResult<null>>
    createSale: (input: DropSaleCreate) => Promise<ApiResult<DropSale>>
    updateSale: (input: DropSaleUpdate) => Promise<ApiResult<DropSale>>
    cancelSale: (id: string) => Promise<ApiResult<null>>
  }
  bosses: {
    syncClears: (input: { date: string }) => Promise<ApiResult<BossBatchSyncResult>>
    previewClears: (input: {
      date: string
      characterId: string
    }) => Promise<ApiResult<BossSyncPreview>>
    applyClears: (input: BossSyncApply) => Promise<ApiResult<BossSyncApplyResult>>
    list: (query: BossQuery) => Promise<ApiResult<BossList>>
    setClear: (input: { id: string; isCleared: boolean }) => Promise<ApiResult<BossRun>>
    updateRun: (input: BossRunUpdate) => Promise<ApiResult<BossRun>>
    updateIncomeDate: (input: BossIncomeDateUpdate) => Promise<ApiResult<BossRun>>
    createRun: (input: BossRunCreate) => Promise<ApiResult<BossRun>>
    settle: (input: CrystalInput) => Promise<ApiResult<BossRun>>
    cancelSale: (id: string) => Promise<ApiResult<null>>
    removeRun: (id: string) => Promise<ApiResult<null>>
  }
  nexon: {
    syncProfiles: (input: {
      force: boolean
      characterIds?: string[]
    }) => Promise<ApiResult<NexonSyncResult>>
    unlink: (characterId: string) => Promise<ApiResult<Character>>
    saveKey: (key: string) => Promise<ApiResult<NexonStatus>>
    removeKey: () => Promise<ApiResult<NexonStatus>>
    status: () => Promise<ApiResult<NexonStatus>>
    list: () => Promise<ApiResult<NexonCharacter[]>>
    basic: (ocid: string) => Promise<ApiResult<NexonProfile>>
    register: (ocid: string) => Promise<ApiResult<NexonRegistration>>
    registerMany: (ocids: string[]) => Promise<ApiResult<NexonBatchResult>>
  }
  system: {
    getInfo: () => Promise<AppInfo>
  }
  characters: {
    avatar: (id: string) => Promise<ApiResult<string | null>>
    list: () => Promise<ApiResult<Character[]>>
    create: (input: CharacterInput) => Promise<ApiResult<Character>>
    update: (input: CharacterUpdate) => Promise<ApiResult<Character>>
    setHidden: (input: CharacterVisibility) => Promise<ApiResult<Character>>
    remove: (id: string) => Promise<ApiResult<null>>
  }
  hunting: {
    list: (query: RecordQuery) => Promise<ApiResult<HuntingList>>
    create: (input: HuntingCreate) => Promise<ApiResult<HuntingSession>>
    update: (input: HuntingUpdate) => Promise<ApiResult<HuntingSession>>
    remove: (id: string) => Promise<ApiResult<null>>
  }
  ledger: {
    createExpense: (input: ExpenseCreate) => Promise<ApiResult<Expense>>
    updateExpense: (input: ExpenseUpdate) => Promise<ApiResult<Expense>>
    removeExpense: (id: string) => Promise<ApiResult<null>>
    list: (query: RecordQuery) => Promise<ApiResult<LedgerList>>
    exportCsv: (query: RecordQuery) => Promise<ApiResult<CsvSaved | null>>
  }
}
