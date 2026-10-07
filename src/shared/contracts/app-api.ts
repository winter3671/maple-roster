import type {
  Character,
  CharacterInput,
  CharacterUpdate,
  CharacterVisibility
} from './character.contract'
import type { ApiResult } from '../errors'

export interface AppInfo {
  name: string
  version: string
  stage: 'local-characters'
}

export interface AppApi {
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
}
