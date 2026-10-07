import { AppError } from '../errors'
import { readId, readObject, readText } from '../validation'

export interface CharacterInput {
  name: string
  world: string
  notes: string
}

export interface Character extends CharacterInput {
  id: string
  isHidden: boolean
  createdAt: string
  updatedAt: string
}

export interface CharacterUpdate extends CharacterInput {
  id: string
}
export interface CharacterVisibility {
  id: string
  isHidden: boolean
}

export function parseCharacterInput(value: unknown): CharacterInput {
  const input = readObject(value)
  return {
    name: readText(input.name, '캐릭터 이름', 40),
    world: readText(input.world, '월드', 40),
    notes: readText(input.notes ?? '', '메모', 500, false, true)
  }
}

export function parseCharacterUpdate(value: unknown): CharacterUpdate {
  const input = readObject(value)
  return { ...parseCharacterInput(input), id: readId(input.id) }
}

export function parseCharacterVisibility(value: unknown): CharacterVisibility {
  const input = readObject(value)
  if (typeof input.isHidden !== 'boolean')
    throw new AppError('VALIDATION_ERROR', '숨김 상태를 확인해 주세요.')
  return { id: readId(input.id), isHidden: input.isHidden }
}
