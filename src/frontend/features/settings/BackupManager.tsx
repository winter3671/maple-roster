import { useEffect, useRef, useState } from 'react'
import type { BackupCounts, BackupPreview } from '../../../shared/contracts/backup.contract'
import { getBridge } from '../../lib/bridge'
import { unwrap } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { useCrystalPrices } from '../prices/CrystalPriceProvider'

const labels: { key: keyof BackupCounts; label: string }[] = [
  { key: 'manualExpenses', label: '직접 지출' },
  { key: 'customPrices', label: '수동 결정석 가격표' },
  { key: 'characters', label: '캐릭터' },
  { key: 'templates', label: '보스 묶음 프리셋' },
  { key: 'bossRuns', label: '주간 보스 기록' },
  { key: 'huntingSessions', label: '사냥 기록' },
  { key: 'dropLots', label: '드랍 획득 묶음' },
  { key: 'dropSales', label: '드랍 판매' },
  { key: 'ledgerEntries', label: '수입·지출 거래' }
]
export function BackupManager() {
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
  async function run(operation: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await operation()
    } catch (caught) {
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
        캐릭터·프리셋·보스·사냥·드랍 판매·거래 기록을 JSON 파일로 보관합니다. API 키는 제외하며, API
        연결 정보와 캐릭터 프로필은 포함합니다.
      </p>
      <p className="mt-2 text-xs leading-6 text-muted">
        복원은 현재 장부 전체를 교체합니다. 복원 직전 장부를 자동으로 안전 백업하고, 파일을 검증한
        뒤 적용합니다. API 키 설정은 유지됩니다.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const saved = await unwrap(getBridge().backup.exportFile())
              if (saved && mounted.current) setNotice(`백업을 저장했습니다: ${saved.filePath}`)
            })
          }
        >
          JSON 백업 저장
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await unwrap(getBridge().backup.selectFile())
              if (mounted.current) {
                setPreview(result)
                setConfirmed(false)
              }
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
            </tbody>
          </table>
          <p className="mt-4 text-xs leading-6 text-muted">
            현재 장부를 전체 교체하며 기록을 합치지 않습니다. 기존 장부는 자동으로 안전 백업합니다.
            API 키는 변경하지 않습니다. 확인은 10분 동안 유효하며 장부가 바뀌면 파일을 다시 선택해야
            합니다.
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
                void run(async () => {
                  const restored = await unwrap(getBridge().backup.restore(preview.id))
                  await prices.reload()
                  if (mounted.current) {
                    setPreview(null)
                    setConfirmed(false)
                    setNotice(
                      `장부를 복원했습니다. 복원 전 장부의 안전 백업: ${restored.recoveryPath}`
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
