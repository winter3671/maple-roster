import { randomUUID } from 'node:crypto'
import {
  parseCharacterInput,
  parseCharacterUpdate,
  type Character
} from '../../../shared/contracts/character.contract'
import { AppError } from '../../../shared/errors'
import { readId } from '../../../shared/validation'
import { CharacterRepository } from './character.repository'

export class CharacterService {
  constructor(private readonly repository: CharacterRepository) {}

  list(): Character[] {
    return this.repository.list()
  }

  create(value: unknown): Character {
    const input = parseCharacterInput(value)
    this.assertUnique(input.name, input.world)
    const timestamp = new Date().toISOString()
    const character: Character = {
      ...input,
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp
    }
    this.write(() => this.repository.insert(character))
    return character
  }

  update(value: unknown): Character {
    const input = parseCharacterUpdate(value)
    const current = this.find(input.id)
    this.assertUnique(input.name, input.world, input.id)
    const character = { ...current, ...input, updatedAt: new Date().toISOString() }
    this.write(() => this.repository.update(character))
    return character
  }

  remove(value: unknown): null {
    const id = readId(value)
    this.find(id)
    this.write(() => this.repository.remove(id))
    return null
  }

  private find(id: string): Character {
    const character = this.repository.find(id)
    if (!character)
      throw new AppError(
        'CHARACTER_NOT_FOUND',
        '캐릭터를 찾을 수 없습니다. 목록을 새로고침해 주세요.'
      )
    return character
  }

  private assertUnique(name: string, world: string, excludeId?: string): void {
    const existing = this.repository.findByIdentity(name, world)
    if (existing && existing.id !== excludeId)
      throw new AppError(
        'DUPLICATE_CHARACTER',
        '같은 이름과 월드의 캐릭터가 이미 등록되어 있습니다.'
      )
  }

  private write(operation: () => void): void {
    try {
      operation()
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'errcode' in error
          ? error.errcode
          : undefined
      if (code === 2067 || code === 1555)
        throw new AppError(
          'DUPLICATE_CHARACTER',
          '같은 이름과 월드의 캐릭터가 이미 등록되어 있습니다.'
        )
      if (
        code === 787 ||
        (code === 1811 && error instanceof Error && error.message.includes('FOREIGN KEY'))
      )
        throw new AppError(
          'CHARACTER_IN_USE',
          '장부 기록이 연결된 캐릭터는 삭제할 수 없습니다. 연결된 기록을 먼저 정리해 주세요.'
        )
      throw error
    }
  }
}
