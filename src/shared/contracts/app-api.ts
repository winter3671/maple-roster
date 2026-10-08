import type {
  Character,
  CharacterInput,
  CharacterUpdate,
  CharacterVisibility
} from './character.contract'
import type { ApiResult } from '../errors'
import type {
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
  BossPreset,
  BossPresetInput,
  BossPresetUpdate,
  BossQuery,
  BossRun,
  BossRunUpdate,
  CrystalInput
} from './boss.contract'
import type {
  NexonStatus,
  NexonCharacter,
  NexonProfile,
  NexonRegistration,
  NexonBatchResult
} from './nexon.contract'

export interface AppInfo {
  name: string
  version: string
  stage: 'hunting-ledger'
}

export interface AppApi {
  drops: {
    list: (source: DropSource) => Promise<ApiResult<DropList>>
    createLot: (input: DropLotCreate) => Promise<ApiResult<DropLot>>
    updateLot: (input: DropLotUpdate) => Promise<ApiResult<DropLot>>
    removeLot: (id: string) => Promise<ApiResult<null>>
    createSale: (input: DropSaleCreate) => Promise<ApiResult<DropSale>>
    updateSale: (input: DropSaleUpdate) => Promise<ApiResult<DropSale>>
    cancelSale: (id: string) => Promise<ApiResult<null>>
  }
  bosses: {
    presets: (characterId?: string) => Promise<ApiResult<BossPreset[]>>
    createPreset: (input: BossPresetInput) => Promise<ApiResult<BossPreset>>
    updatePreset: (input: BossPresetUpdate) => Promise<ApiResult<BossPreset>>
    removePreset: (id: string) => Promise<ApiResult<null>>
    list: (query: BossQuery) => Promise<ApiResult<BossList>>
    generate: (query: BossQuery) => Promise<ApiResult<BossList>>
    setClear: (input: { id: string; isCleared: boolean }) => Promise<ApiResult<BossRun>>
    updateRun: (input: BossRunUpdate) => Promise<ApiResult<BossRun>>
    settle: (input: CrystalInput) => Promise<ApiResult<BossRun>>
    cancelSale: (id: string) => Promise<ApiResult<null>>
    removeRun: (id: string) => Promise<ApiResult<null>>
  }
  nexon: {
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
  ledger: { list: (query: RecordQuery) => Promise<ApiResult<LedgerList>> }
}
