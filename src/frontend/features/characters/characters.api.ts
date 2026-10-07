import type {
  CharacterInput,
  CharacterUpdate,
  CharacterVisibility
} from '../../../shared/contracts/character.contract'
import { unwrap } from '../../lib/api'
import { getBridge } from '../../lib/bridge'

export const charactersApi = {
  list: () => unwrap(getBridge().characters.list()),
  create: (input: CharacterInput) => unwrap(getBridge().characters.create(input)),
  update: (input: CharacterUpdate) => unwrap(getBridge().characters.update(input)),
  setHidden: (input: CharacterVisibility) => unwrap(getBridge().characters.setHidden(input)),
  remove: (id: string) => unwrap(getBridge().characters.remove(id))
}
