import { CRYSTAL_PRICES_CHECKED_ON } from '../../../shared/crystal-prices'

export function CrystalPriceInfo() {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold">결정 가격</h2>
      <p className="mt-3 text-xs leading-6 text-muted">
        결정 가격은 앱에 포함된 가격표로 자동 계산합니다. 메이플스토리 공지에서 가격 변경을 확인하면
        가격표를 갱신해 앱 업데이트로 제공합니다. 이미 기록한 보스 수익은 유지됩니다.
      </p>
      <p className="mt-2 text-[11px] text-muted">가격표 확인일: {CRYSTAL_PRICES_CHECKED_ON}</p>
    </section>
  )
}
