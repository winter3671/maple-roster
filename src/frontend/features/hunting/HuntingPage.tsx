import { EmptyState } from '../../components/ui/EmptyState'

export function HuntingPage() {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-sm font-semibold">사냥 회차</h2>
        <p className="mt-1 text-xs text-muted">사냥 시간 · 획득 메소 · 아이템 수량 · 소모 비용</p>
      </div>
      <EmptyState
        icon="hunting"
        title="오늘의 사냥을 기록할 공간이에요"
        description="회차별 기록과 시간당 수익을 확인할 수 있도록 준비하고 있습니다. 같은 날에도 여러 캐릭터의 사냥을 나눠 기록합니다."
      />
    </section>
  )
}
