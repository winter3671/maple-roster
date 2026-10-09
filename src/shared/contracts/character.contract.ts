import { readId, readObject, readText } from '../validation'

export interface CharacterInput {
  name: string
  world: string
  notes: string
}

export interface Character extends CharacterInput {
  id: string
  createdAt: string
  updatedAt: string
  nexon?: {
    ocid: string
    profile: {
      level: number
      job: string
      guild: string
      fetchedAt: string
      imageUrl?: string | null
    } | null
  }
}

export interface CharacterUpdate extends CharacterInput {
  id: string
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
