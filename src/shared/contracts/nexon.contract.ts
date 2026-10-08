import type { Character } from './character.contract'
import { AppError, type ErrorCode } from '../errors'

export interface NexonCharacter {
  ocid: string
  name: string
  world: string
  job: string
  level: number
}
export interface NexonProfile extends NexonCharacter {
  guild: string
  fetchedAt: string
}
export interface NexonStatus {
  configured: boolean
  issue: 'missing' | 'unreadable' | 'invalid' | null
  keySource?: 'saved' | 'env' | null
  hasSavedKey?: boolean
  encryptionAvailable?: boolean
}
export interface NexonRegistration {
  character: Character
  alreadyRegistered: boolean
}
export type NexonBatchItem =
  | { ocid: string; status: 'created' | 'existing'; character: Character }
  | { ocid: string; status: 'failed' | 'notAttempted'; error: { code: ErrorCode; message: string } }
export interface NexonBatchResult {
  items: NexonBatchItem[]
}
export interface NexonSyncResult {
  items: (
    | { characterId: string; status: 'updated' }
    | {
        characterId: string
        status: 'failed' | 'notAttempted'
        error: { code: ErrorCode; message: string }
      }
  )[]
}

export function readOcidSelection(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500)
    throw new AppError('VALIDATION_ERROR', '등록할 캐릭터를 1~500개 선택해 주세요.')
  return [...new Set(value.map(readOcid))]
}

export function readOcid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw new AppError('VALIDATION_ERROR', '캐릭터 식별자를 확인해 주세요.')
  return value
}
