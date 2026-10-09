import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import type { BossList, BossQuery } from '../../../shared/contracts/boss.contract'
import { charactersApi } from '../characters/characters.api'
import { bossesApi } from './bosses.api'

export function useBosses(query: BossQuery) {
  const [data, setData] = useState<BossList>()
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const active = useRef(false)
  const lock = useRef(false)
  const sequence = useRef(0)
  const load = useCallback(
    () => Promise.all([bossesApi.list(query), charactersApi.list()]),
    [query]
  )
  const apply = ([list, characterList]: Awaited<ReturnType<typeof load>>) => {
    setData(list)
    setCharacters(characterList)
  }
  const reload = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setError('')
    setData(undefined)
    try {
      const result = await load()
      if (active.current && request === sequence.current) {
        setData(result[0])
        setCharacters(result[1])
      }
    } catch (caught) {
      if (active.current && request === sequence.current)
        setError(caught instanceof Error ? caught.message : '보스 기록을 불러오지 못했습니다.')
    } finally {
      if (active.current && request === sequence.current) setLoading(false)
    }
  }, [load])
  useEffect(() => {
    active.current = true
    void reload()
    return () => {
      active.current = false
      sequence.current++
    }
  }, [reload])
  async function mutate(operation: () => Promise<unknown>, message: string): Promise<boolean> {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    let saved = false
    try {
      await operation()
      saved = true
      const result = await load()
      if (active.current) {
        apply(result)
        setNotice(message)
      }
      return true
    } catch (caught) {
      if (active.current)
        setError(
          saved
            ? '변경은 저장했지만 목록을 불러오지 못했습니다. 새로고침해 주세요.'
            : caught instanceof Error
              ? caught.message
              : '기록을 저장하지 못했습니다.'
        )
      return saved
    } finally {
      lock.current = false
      if (active.current) setBusy(false)
    }
  }
  return {
    data,
    characters,
    loading,
    busy,
    error,
    notice,
    reload,
    mutate,
    clearFeedback: () => {
      setError('')
      setNotice('')
    }
  }
}
