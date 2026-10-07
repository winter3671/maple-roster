import type {
  CharacterInput,
  CharacterUpdate,
  CharacterVisibility
} from '../../../shared/contracts/character.contract'
import { AppError, type ApiResult } from '../../../shared/errors'
import { getBridge } from '../../lib/bridge'

async function unwrap<T>(request: Promise<ApiResult<T>>): Promise<T> {
  const result = await request
  if (!result.ok) throw new AppError(result.error.code, result.error.message)
  return result.data
}

export const charactersApi = {
  list: () => unwrap(getBridge().characters.list()),
  create: (input: CharacterInput) => unwrap(getBridge().characters.create(input)),
  update: (input: CharacterUpdate) => unwrap(getBridge().characters.update(input)),
  setHidden: (input: CharacterVisibility) => unwrap(getBridge().characters.setHidden(input)),
  remove: (id: string) => unwrap(getBridge().characters.remove(id))
}
