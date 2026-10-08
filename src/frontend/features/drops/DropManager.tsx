import { useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../../shared/errors'
import {
  parseDropLot,
  parseDropSale,
  type DropSource,
  type DropList,
  type DropLot
} from '../../../shared/contracts/drop.contract'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { formatMeso } from '../../lib/format'

import { DropEditor, type Editor } from './DropEditor'

export function DropManager({
  source,
  title,
  onClose,
  onChanged
}: {
  source: DropSource
  title: string
  onClose: () => void
  onChanged: () => Promise<unknown>
}) {
  const [data, setData] = useState<DropList>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<Editor>()
  const [confirmation, setConfirmation] = useState<{
    text: string
    action: () => Promise<ApiResult<unknown>>
  }>()
  const lock = useRef(false)
  const alive = useRef(false)
  const loadVersion = useRef(0)
  const retry = useRef<{ fingerprint: string; id: string } | null>(null)
  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [source.kind, source.id])
  async function load() {
    const version = ++loadVersion.current
    setLoading(true)
    try {
      const result = await window.maple.drops.list(source)
      if (!alive.current || version !== loadVersion.current) return
      if (result.ok) setData(result.data)
      else setError(result.error.message)
    } catch {
      if (alive.current && version === loadVersion.current)
        setError('드랍 목록을 불러오지 못했습니다. 다시 조회해 주세요.')
    } finally {
      if (alive.current && version === loadVersion.current) setLoading(false)
    }
  }
  async function mutate(action: () => Promise<ApiResult<unknown>>): Promise<boolean> {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await action()
      if (!result.ok) {
        setError(result.error.message)
        return false
      }
      retry.current = null
      setEditor(undefined)
      setConfirmation(undefined)
      setNotice('저장했습니다. 판매 수량과 연결 수입을 반영했습니다.')
      await load()
      try {
        await onChanged()
      } catch {
        setError('저장했지만 활동 목록 갱신에 실패했습니다. 화면에서 새로고침해 주세요.')
      }
      return true
    } catch {
      setError('처리 결과를 확인하지 못했습니다. 같은 내용으로 다시 저장하거나 새로고침해 주세요.')
      return false
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  function requestId(input: unknown) {
    const fingerprint = JSON.stringify(input)
    if (retry.current?.fingerprint !== fingerprint)
      retry.current = { fingerprint, id: crypto.randomUUID() }
    return retry.current.id
  }
  function edit(value: Editor) {
    setError('')
    setNotice('')
    setEditor(value)
  }
  return (
    <Dialog title={`드랍 관리 · ${title}`} busy={busy} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs leading-5 text-muted">
          예상 금액은 미판매 재고의 참고값입니다. 판매를 기록하면 수수료와 분배를 반영한 내 몫만
          거래 장부에 수입으로 등록됩니다.
        </p>
        {source.kind === 'boss' && (
          <p className="text-[11px] text-muted">
            획득 기준일은 보스 주차 시작일입니다. 실제 판매일은 별도로 입력하세요.
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs leading-5 text-expense">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-xs text-brand">
            {notice}
          </p>
        )}
        {data && (
          <div className="rounded-xl bg-canvas p-4 text-xs leading-6">
            미판매 {formatMeso(data.summary.remainingQuantity)}개 · 예상{' '}
            {formatMeso(data.summary.estimatedValue)} 메소
            <br />
            누적 판매 내 몫 {formatMeso(data.summary.saleIncome)} 메소
          </div>
        )}
        {confirmation ? (
          <section className="rounded-xl border border-expense/20 p-4">
            <p className="text-xs leading-5">{confirmation.text}</p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirmation(undefined)}
              >
                돌아가기
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void mutate(confirmation.action)}
              >
                취소·삭제 확인
              </Button>
            </div>
          </section>
        ) : editor ? (
          <DropEditor
            key={`${editor.kind}-${editor.lot?.id ?? 'new'}-${editor.kind === 'sale' ? (editor.sale?.id ?? 'new') : ''}`}
            editor={editor}
            busy={busy}
            onCancel={() => setEditor(undefined)}
            onSave={async (raw) => {
              if (editor.kind === 'lot') {
                const input = parseDropLot({ ...raw, source })
                return mutate(() =>
                  editor.lot
                    ? window.maple.drops.updateLot({
                        id: editor.lot.id,
                        quantity: input.quantity,
                        estimatedUnitPrice: input.estimatedUnitPrice,
                        notes: input.notes
                      })
                    : window.maple.drops.createLot({ ...input, requestId: requestId(input) })
                )
              }
              const input = parseDropSale({ ...raw, lotId: editor.lot.id })
              return mutate(() =>
                editor.sale
                  ? window.maple.drops.updateSale({ ...input, id: editor.sale.id })
                  : window.maple.drops.createSale({ ...input, requestId: requestId(input) })
              )
            }}
          />
        ) : (
          <div className="flex gap-2">
            <Button disabled={busy || loading || !data} onClick={() => edit({ kind: 'lot' })}>
              획득 아이템 추가
            </Button>
            <Button
              variant="secondary"
              disabled={busy || loading}
              onClick={() => {
                setError('')
                void load()
              }}
            >
              새로고침
            </Button>
          </div>
        )}
        {loading && (
          <p role="status" className="text-xs text-muted">
            드랍 목록을 불러오는 중…
          </p>
        )}
        {data?.lots.length === 0 && (
          <p className="py-4 text-center text-xs text-muted">
            획득 아이템이 없습니다. 사냥 조각·젬스톤은 회차에 입력한 수량으로 자동 등록됩니다.
          </p>
        )}
        {data?.lots.map((lot) => (
          <article key={lot.id} className="rounded-xl border border-line p-4">
            <h3 className="break-words text-sm font-semibold">{lot.itemName}</h3>
            <p className="mt-2 text-xs leading-6 text-muted">
              획득 {formatMeso(lot.quantity)}개 · 판매 {formatMeso(lot.soldQuantity)}개 · 남은{' '}
              {formatMeso(lot.remaining)}개<br />
              예상 단가 {formatMeso(lot.estimatedUnitPrice)} 메소 · 미판매 예상{' '}
              {formatMeso(lot.estimatedValue)} 메소
            </p>
            {lot.notes && (
              <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted">{lot.notes}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={busy || !!editor || !!confirmation || !lot.remaining}
                onClick={() => edit({ kind: 'sale', lot })}
              >
                판매 기록
              </Button>
              <Button
                variant="secondary"
                disabled={busy || !!editor || !!confirmation}
                onClick={() => edit({ kind: 'lot', lot })}
              >
                획득 수정
              </Button>
              {!lot.managedKind && (
                <Button
                  variant="secondary"
                  disabled={busy || !!editor || !!confirmation || lot.soldQuantity > 0}
                  onClick={() =>
                    setConfirmation({
                      text: `${lot.itemName} 획득 묶음을 삭제합니다.`,
                      action: () => window.maple.drops.removeLot(lot.id)
                    })
                  }
                >
                  획득 삭제
                </Button>
              )}
            </div>
            {data.sales
              .filter((sale) => sale.lotId === lot.id)
              .map((sale) => (
                <div key={sale.id} className="mt-4 border-t border-line pt-3 text-xs">
                  <p>
                    {sale.date} · {formatMeso(sale.quantity)}개 판매
                  </p>
                  <p className="mt-2 leading-5 text-muted">
                    전체 {formatMeso(sale.grossAmount)} · 수수료 {formatMeso(sale.feeAmount)} ·{' '}
                    {sale.partySize}인 {sale.shareMode === 'equal' ? '균등 분배' : '직접 분배'}
                    <br />내 몫{' '}
                    <span className="font-semibold text-brand">
                      {formatMeso(sale.netShare)} 메소
                    </span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy || !!editor || !!confirmation}
                      onClick={() => edit({ kind: 'sale', lot, sale })}
                    >
                      판매 수정
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || !!editor || !!confirmation}
                      onClick={() =>
                        setConfirmation({
                          text: '판매 기록과 연결 수입을 취소합니다. 판매 수량은 미판매 재고로 돌아갑니다.',
                          action: () => window.maple.drops.cancelSale(sale.id)
                        })
                      }
                    >
                      판매 취소
                    </Button>
                  </div>
                </div>
              ))}
          </article>
        ))}
      </div>
    </Dialog>
  )
}
