import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character, CharacterInput } from '../../../shared/contracts/character.contract'
import { AppError } from '../../../shared/errors'
import { charactersApi } from './characters.api'
import { nexonApi } from '../nexon/nexon.api'
import type { NexonSyncResult } from '../../../shared/contracts/nexon.contract'
import { useTaskNotifications } from '../../components/TaskNotifications'
import { batchTaskStatus } from '../../../shared/task-notifications'

export function useCharacters() {
  const tasks = useTaskNotifications()
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<NexonSyncResult | null>(null)
  const mounted = useRef(false)
  const pending = useRef(false)
  const sequence = useRef(0)

  const reload = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    setError(null)
    setLoadError(null)
    setLoaded(false)
    try {
      const list = await charactersApi.list()
      if (mounted.current && request === sequence.current) {
        setCharacters(list)
        setLoaded(true)
      }
    } catch (caught) {
      if (mounted.current && request === sequence.current) {
        const message =
          caught instanceof AppError
            ? caught.message
            : '목록을 불러오지 못했습니다. 다시 시도해 주세요.'
        setError(message)
        setLoadError(message)
      }
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

  async function mutate(
    operation: () => Promise<unknown>,
    message: string,
    notifyProfiles = false
  ): Promise<boolean> {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    setSyncResult(null)
    let saved = false
    const task = notifyProfiles ? tasks.begin('캐릭터 API 프로필 갱신') : undefined
    try {
      const result = await operation()
      saved = true
      const list = await charactersApi.list()
      if (mounted.current) {
        setCharacters(list)
        setLoaded(true)
        setLoadError(null)
        setNotice(message)
      }
      if (task) {
        const items = (result as NexonSyncResult).items
        const succeeded = items.filter((item) => item.status === 'updated').length
        const incomplete = items.length - succeeded
        task.finish(
          batchTaskStatus(succeeded, incomplete),
          `갱신 ${succeeded}명 · 실패·미처리 ${incomplete}명. 캐릭터 관리에서 상세 결과를 확인해 주세요.`
        )
      }
      return true
    } catch (caught) {
      task?.finish(
        saved ? 'warning' : 'error',
        saved
          ? 'API 확인은 끝났지만 캐릭터 목록을 갱신하지 못했습니다. 다시 조회해 주세요.'
          : 'API 프로필을 갱신하지 못했습니다. 다시 시도해 주세요.'
      )
      if (saved && mounted.current) {
        setLoaded(false)
        setLoadError('변경은 저장했지만 캐릭터 목록을 불러오지 못했습니다. 다시 조회해 주세요.')
      }
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
    loadError,
    loaded,
    notice,
    syncResult,
    reload,
    clearFeedback: () => {
      setError(null)
      setNotice(null)
      setSyncResult(null)
    },
    syncProfiles: (force: boolean, characterIds?: string[]) =>
      mutate(
        async () => {
          const result = await nexonApi.syncProfiles(force, characterIds)
          if (mounted.current) setSyncResult(result)
          return result
        },
        force ? 'API 프로필 갱신을 완료했습니다. 아래 결과를 확인하세요.' : '',
        force
      ),
    unlink: (id: string) =>
      mutate(() => nexonApi.unlink(id), 'API 연결을 해제했습니다. 캐릭터와 장부는 유지됩니다.'),
    create: (input: CharacterInput) =>
      mutate(() => charactersApi.create(input), '캐릭터를 등록했습니다.'),
    update: (id: string, input: CharacterInput) =>
      mutate(() => charactersApi.update({ id, ...input }), '캐릭터 정보를 수정했습니다.'),
    remove: (id: string) => mutate(() => charactersApi.remove(id), '캐릭터를 삭제했습니다.')
  }
}
