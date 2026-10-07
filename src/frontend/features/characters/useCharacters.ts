import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character, CharacterInput } from '../../../shared/contracts/character.contract'
import { AppError } from '../../../shared/errors'
import { charactersApi } from './characters.api'

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const mounted = useRef(false)
  const pending = useRef(false)
  const sequence = useRef(0)

  const reload = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setError(null)
    try {
      const list = await charactersApi.list()
      if (mounted.current && request === sequence.current) setCharacters(list)
    } catch (caught) {
      if (mounted.current && request === sequence.current)
        setError(
          caught instanceof AppError
            ? caught.message
            : '목록을 불러오지 못했습니다. 다시 시도해 주세요.'
        )
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void reload()
    return () => {
      mounted.current = false
      sequence.current++
    }
  }, [reload])

  async function mutate(operation: () => Promise<unknown>, message: string): Promise<boolean> {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    let saved = false
    try {
      await operation()
      saved = true
      const list = await charactersApi.list()
      if (mounted.current) {
        setCharacters(list)
        setNotice(message)
      }
      return true
    } catch (caught) {
      if (mounted.current)
        setError(
          saved
            ? '변경은 저장했지만 목록을 불러오지 못했습니다. 새로고침해 주세요.'
            : caught instanceof AppError
              ? caught.message
              : '기록을 처리하지 못했습니다. 다시 시도해 주세요.'
        )
      return saved
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return {
    characters,
    loading,
    busy,
    error,
    notice,
    reload,
    clearFeedback: () => {
      setError(null)
      setNotice(null)
    },
    create: (input: CharacterInput) =>
      mutate(() => charactersApi.create(input), '캐릭터를 등록했습니다.'),
    update: (id: string, input: CharacterInput) =>
      mutate(() => charactersApi.update({ id, ...input }), '캐릭터 정보를 수정했습니다.'),
    setHidden: (character: Character) =>
      mutate(
        () => charactersApi.setHidden({ id: character.id, isHidden: !character.isHidden }),
        character.isHidden ? '캐릭터를 다시 표시합니다.' : '캐릭터를 숨겼습니다.'
      ),
    remove: (id: string) => mutate(() => charactersApi.remove(id), '캐릭터를 삭제했습니다.')
  }
}
