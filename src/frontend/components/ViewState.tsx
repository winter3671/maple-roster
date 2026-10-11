import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import { missingCharacter, ViewStateStore, type ViewStates } from '../../shared/view-state'

const Context = createContext<ViewStateStore | null>(null)
export function ViewStateProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new ViewStateStore())
  return <Context.Provider value={store}>{children}</Context.Provider>
}

export function useViewState<K extends keyof ViewStates>(key: K, initial: () => ViewStates[K]) {
  const store = useContext(Context)
  if (!store) throw new Error('ViewStateProvider가 필요합니다.')
  const initializer = useRef(initial)
  initializer.current = initial
  const value = useSyncExternalStore(store.subscribe, () => store.read(key, initializer.current))
  const setValue = useCallback(
    (next: ViewStates[K] | ((current: ViewStates[K]) => ViewStates[K])) =>
      store.update(key, initializer.current, next),
    [store, key]
  )
  return [value, setValue] as const
}

export function useMissingCharacterReset(
  characterId: string | undefined,
  characters: readonly { id: string }[],
  loaded: boolean,
  reset: () => void
) {
  useEffect(() => {
    if (missingCharacter(characterId, characters, loaded)) reset()
  }, [characterId, characters, loaded, reset])
}
