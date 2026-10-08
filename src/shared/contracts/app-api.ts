import type {
  Character,
  CharacterInput,
  CharacterUpdate,
  CharacterVisibility
} from './character.contract'
import type { ApiResult } from '../errors'
import type { HuntingCreate, HuntingUpdate, HuntingSession, HuntingList } from './hunting.contract'
import type { LedgerList, RecordQuery } from './ledger.contract'
import type { NexonStatus, NexonCharacter, NexonProfile, NexonRegistration } from './nexon.contract'

export interface AppInfo {
  name: string
  version: string
  stage: 'hunting-ledger'
}

export interface AppApi {
  nexon: {
    status: () => Promise<ApiResult<NexonStatus>>
    list: () => Promise<ApiResult<NexonCharacter[]>>
    basic: (ocid: string) => Promise<ApiResult<NexonProfile>>
    register: (ocid: string) => Promise<ApiResult<NexonRegistration>>
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
