import { Button } from './Button'

export function QueryFailure({
  label,
  message,
  onRetry,
  busy = false
}: {
  label: string
  message?: string | null
  onRetry: () => void
  busy?: boolean
}) {
  return (
    <div role="alert" className="rounded-xl border border-expense/20 bg-expense/5 p-5">
      <h3 className="text-sm font-semibold text-expense">{label} 조회에 실패했어요</h3>
      <p className="mt-2 text-xs leading-6 text-muted">
        {message || '조회 결과를 확인하지 못했습니다. 다시 시도해 주세요.'}
      </p>
      <p className="mt-1 text-xs leading-6 text-muted">
        기록이 없다는 뜻은 아닙니다. 다시 조회해 저장된 기록을 확인해 주세요.
      </p>
      <Button variant="secondary" disabled={busy} onClick={onRetry} className="mt-3">
        다시 시도
      </Button>
    </div>
  )
}
