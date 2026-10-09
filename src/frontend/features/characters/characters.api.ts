import type { CharacterInput, CharacterUpdate } from '../../../shared/contracts/character.contract'
import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'

export const charactersApi = {
  list: () => unwrap(getBridge().characters.list()),
  create: (input: CharacterInput) => unwrap(getBridge().characters.create(input)),
  update: (input: CharacterUpdate) => unwrap(getBridge().characters.update(input)),
  remove: (id: string) => unwrap(getBridge().characters.remove(id))
}
