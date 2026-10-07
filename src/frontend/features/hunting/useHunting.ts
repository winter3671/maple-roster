import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character } from '../../../shared/contracts/character.contract'
import type { HuntingInput, HuntingList } from '../../../shared/contracts/hunting.contract'
import type { RecordQuery } from '../../../shared/contracts/ledger.contract'
import { AppError } from '../../../shared/errors'
import { charactersApi } from '../characters/characters.api'
import { huntingApi } from './hunting.api'

export function useHunting(query: RecordQuery) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [data, setData] = useState<HuntingList>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const mounted = useRef(false)
  const pending = useRef(false)
  const sequence = useRef(0)
  const createRequest = useRef<{ fingerprint: string; id: string } | null>(null)

  const reload = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setData(undefined)
    setError(null)
    try {
      const [list, characterList] = await Promise.all([
        huntingApi.list(query),
        charactersApi.list()
      ])
      if (mounted.current && request === sequence.current) {
        setData(list)
        setCharacters(characterList)
      }
    } catch (caught) {
      if (mounted.current && request === sequence.current)
        setError(caught instanceof AppError ? caught.message : '사냥 기록을 불러오지 못했습니다.')
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false)
    }
  }, [query])

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
      const list = await huntingApi.list(query)
      if (mounted.current) {
        setData(list)
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
    data,
    loading,
    busy,
    error,
    notice,
    reload,
    clearFeedback: () => {
      setError(null)
      setNotice(null)
    },
    create: async (input: HuntingInput) => {
      const fingerprint = JSON.stringify(input)
      if (!createRequest.current || createRequest.current.fingerprint !== fingerprint)
        createRequest.current = { fingerprint, id: crypto.randomUUID() }
      const requestId = createRequest.current.id
      const saved = await mutate(
        () => huntingApi.create({ ...input, requestId }),
        '사냥 기록을 저장했습니다. 조회 기간 밖의 기록은 해당 기간을 조회하면 볼 수 있습니다.'
      )
      if (saved) createRequest.current = null
      return saved
    },
    update: (id: string, input: HuntingInput) =>
      mutate(() => huntingApi.update({ id, ...input }), '사냥 기록과 연결된 거래를 수정했습니다.'),
    remove: (id: string) =>
      mutate(() => huntingApi.remove(id), '사냥 기록과 연결된 거래를 삭제했습니다.')
  }
}
