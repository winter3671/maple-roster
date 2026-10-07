import { EmptyState } from '../../components/ui/EmptyState'

export function LedgerPage() {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-sm font-semibold">수입과 지출</h2>
        <p className="mt-1 text-xs text-muted">실제 판매·수령일 기준의 거래 기록</p>
      </div>
      <EmptyState
        icon="ledger"
        title="아직 거래 내역이 없어요"
        description="결정석과 아이템 판매 수입, 구매·강화 지출을 모아 보여줄 예정입니다. 미판매 아이템은 실제 수입에 포함하지 않습니다."
      />
    </section>
  )
}
