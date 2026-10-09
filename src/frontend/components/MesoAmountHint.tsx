import { formatKoreanMeso, parseDigits } from '../lib/format'

export function MesoAmountHint({ value }: { value: string | number }) {
  if (typeof value === 'string' && !value.trim()) return null
  const numeric = typeof value === 'number' ? value : parseDigits(value)
  const formatted = formatKoreanMeso(Math.abs(numeric))
  const amount = formatted && numeric < 0 ? `-${formatted}` : formatted
  return (
    <p className="mt-1 text-xs font-semibold leading-5 text-amber-700">
      {amount ?? '금액을 확인해 주세요.'}
    </p>
  )
}
