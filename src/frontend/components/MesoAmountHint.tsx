import { formatKoreanMeso, parseDigits } from '../lib/format'

export function MesoAmountHint({ value }: { value: string }) {
  if (!value.trim()) return null
  const amount = formatKoreanMeso(parseDigits(value))
  return (
    <p className="mt-1 text-xs font-semibold leading-5 text-amber-700">
      {amount ?? '금액을 확인해 주세요.'}
    </p>
  )
}
