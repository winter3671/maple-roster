import { useEffect, useRef, useState } from 'react'
import type { BackupCounts, BackupPreview } from '../../../shared/contracts/backup.contract'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { useCrystalPrices } from '../prices/CrystalPriceProvider'
import { useTaskNotifications } from '../../components/TaskNotifications'
import type { TaskHandle } from '../../../shared/task-notifications'

const labels: { key: keyof BackupCounts; label: string }[] = [
  { key: 'characters', label: '캐릭터' },
  { key: 'bossRuns', label: '주간·월간 보스 기록' },
  { key: 'huntingSessions', label: '사냥 기록' },
  { key: 'dropLots', label: '드랍 획득 기록' },
  { key: 'dropSales', label: '드랍 판매' },
  { key: 'manualIncomes', label: '직접 수익' },
  { key: 'manualExpenses', label: '직접 지출' },
  { key: 'ledgerEntries', label: '수입·지출 거래' }
]
const legacyLabels: typeof labels = [
  { key: 'templates', label: '이전 보스 구성' },
  { key: 'customPrices', label: '이전 수동 가격표' }
]
export function BackupManager() {
  const tasks = useTaskNotifications()
  const prices = useCrystalPrices()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<BackupPreview | null>(null),
    [confirmed, setConfirmed] = useState(false)
  const lock = useRef(false),
    mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function run(title: string, operation: (task: TaskHandle) => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    const task = tasks.begin(title)
    try {
      await operation(task)
    } catch (caught) {
      task.finish('error', '작업을 완료하지 못했습니다. 설정에서 상세 오류를 확인해 주세요.')
      if (mounted.current)
        setError(caught instanceof Error ? caught.message : '백업 작업에 실패했습니다.')
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }
  function close() {
    if (busy) return
    setPreview(null)
    setConfirmed(false)
    setError('')
    void unwrap(getBridge().backup.cancel()).catch(() => {})
  }
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold">백업과 복원</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        캐릭터·주간 및 월간 보스·사냥·드랍 획득과 판매·직접 수익과 지출·거래 기록을 JSON 파일로
        저장합니다. 저장할 위치를 직접 선택해 다른 기기로 옮기거나 별도로 보관할 수 있습니다.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted">
        캐릭터의 API 연결 정보와 프로필은 포함하며 API 키는 제외합니다. 주간 콘텐츠 조회 결과와 앱
        설정은 포함하지 않습니다.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted">
        복원할 때는 파일 검증과 기록 수 확인 후 현재 장부 전체를 교체합니다. 적용 직전 기존 장부를
        안전 백업하며, 이 PC의 API 키 설정은 유지합니다.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            void run('JSON 백업 저장', async (task) => {
              const saved = await unwrap(getBridge().backup.exportFile())
              if (saved && mounted.current) setNotice(`백업을 저장했습니다: ${saved.filePath}`)
              if (saved) task.finish('success', '장부를 JSON 파일로 저장했습니다.')
              else task.cancel()
            })
          }
        >
          JSON 백업 저장
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run('백업 파일 확인', async (task) => {
              const result = await unwrap(getBridge().backup.selectFile())
              if (mounted.current) {
                setPreview(result)
                setConfirmed(false)
              }
              if (result)
                task.finish('success', '백업 파일을 확인했습니다. 복원할 내용을 검토해 주세요.')
              else task.cancel()
            })
          }
        >
          백업 파일로 복원
        </Button>
      </div>
      {busy && (
        <p role="status" className="mt-3 text-xs text-muted">
          백업 작업을 처리하고 있습니다…
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 break-all text-xs leading-6 text-brand">
          {notice}
        </p>
      )}
      {error && !preview && (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error}
        </p>
      )}
      {preview && (
        <Dialog title="장부 백업 복원 확인" busy={busy} onClose={close}>
          <p className="break-all text-sm font-semibold">{preview.fileName}</p>
          <p className="mt-2 text-xs text-muted">
            백업 생성:{' '}
            {new Date(preview.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)
          </p>
          <table className="mt-4 w-full text-left text-xs">
            <thead>
              <tr>
                {['기록', '현재 장부', '복원할 백업'].map((label) => (
                  <th key={label} scope="col" className="border-b border-line py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map(({ key, label }) => (
                <tr key={key}>
                  <th scope="row" className="py-2 font-normal">
                    {label}
                  </th>
                  <td className="tabular-nums">{preview.current[key].toLocaleString('ko-KR')}</td>
                  <td className="tabular-nums">{preview.incoming[key].toLocaleString('ko-KR')}</td>
                </tr>
              ))}
              {legacyLabels.some(({ key }) => preview.current[key] || preview.incoming[key]) && (
                <tr>
                  <th
                    colSpan={3}
                    className="border-t border-line pt-4 pb-2 font-semibold text-muted"
                  >
                    이전 버전 호환 기록
                  </th>
                </tr>
              )}
              {legacyLabels
                .filter(({ key }) => preview.current[key] || preview.incoming[key])
                .map(({ key, label }) => (
                  <tr key={key} className="text-muted">
                    <th scope="row" className="py-2 font-normal">
                      {label}
                    </th>
                    <td className="tabular-nums">{preview.current[key].toLocaleString('ko-KR')}</td>
                    <td className="tabular-nums">
                      {preview.incoming[key].toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs leading-6 text-muted">
            보스 기록은 주간·월간 합계입니다. 거래는 각 장부의 수익과 직접 수익·지출을 반영한 별도
            기록이므로 항목별 기록 수를 합산해 거래 건수로 보지 않습니다.
          </p>
          <p className="mt-4 text-xs leading-6 text-muted">
            현재 장부를 전체 교체하며 기록을 합치지 않습니다. 기존 장부는 자동으로 안전 백업합니다.
            API 키는 변경하지 않습니다. 확인은 10분 동안 유효하며 장부가 바뀌면 파일을 다시 선택해야
            합니다. 주간 콘텐츠 조회 결과는 복원 후 다시 확인해 주세요.
          </p>
          <label className="mt-4 flex items-start gap-2 text-xs leading-6">
            <input
              aria-label="현재 장부 전체 교체 확인"
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 accent-brand"
            />
            현재 장부가 백업 내용으로 전체 교체되는 것을 확인했습니다.
          </label>
          {error && (
            <p role="alert" className="mt-3 text-xs leading-6 text-expense">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={close}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={busy || !confirmed}
              onClick={() =>
                void run('장부 전체 복원', async (task) => {
                  const restored = await unwrap(getBridge().backup.restore(preview.id))
                  if (mounted.current) {
                    setPreview(null)
                    setConfirmed(false)
                    setNotice(
                      `장부를 복원했습니다. 복원 전 장부의 안전 백업: ${restored.recoveryPath}`
                    )
                  }
                  try {
                    await prices.reload()
                    task.finish(
                      'success',
                      '장부를 복원했습니다. 복원 전 장부는 안전 백업으로 보관했습니다.'
                    )
                  } catch {
                    task.finish(
                      'warning',
                      '장부는 복원했지만 화면 정보를 다시 불러오지 못했습니다. 재조회해 주세요.'
                    )
                  }
                })
              }
            >
              장부 전체 복원
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  )
}
