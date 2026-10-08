import type { Character } from './character.contract'
import { AppError } from '../errors'

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
}
export interface NexonRegistration {
  character: Character
  alreadyRegistered: boolean
}

export function readOcid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw new AppError('VALIDATION_ERROR', '캐릭터 식별자를 확인해 주세요.')
  return value
}
