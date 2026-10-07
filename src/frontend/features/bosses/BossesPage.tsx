import { EmptyState } from '../../components/ui/EmptyState'

export function BossesPage() {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-6 py-5">
        <h2 className="text-sm font-semibold">캐릭터별 보스 기록</h2>
        <p className="mt-1 text-xs text-muted">클리어 확인 · 결정석 판매 · 드랍 분배</p>
      </div>
      <EmptyState
        icon="boss"
        title="아직 보스 기록이 없어요"
        description="캐릭터를 등록한 뒤 평소 도는 보스와 난이도를 설정할 수 있도록 준비하고 있습니다. 클리어와 수익 확정은 따로 관리합니다."
      />
    </section>
  )
}
