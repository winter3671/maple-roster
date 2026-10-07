import { EmptyState } from '../../components/ui/EmptyState'

export function CharactersPage() {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <h2 className="text-sm font-semibold">나의 캐릭터</h2>
        <span className="text-xs text-muted">등록 기능 준비 중</span>
      </div>
      <EmptyState
        icon="characters"
        title="첫 캐릭터를 기다리고 있어요"
        description="다음 단계에서 캐릭터 이름과 월드를 직접 등록하고, 앱을 다시 열어도 기록이 유지되도록 연결합니다."
      />
    </section>
  )
}
