import type { PageId } from '../../app/navigation'
import { EmptyState } from '../../components/ui/EmptyState'
import { Icon, type IconName } from '../../components/ui/Icon'

const summaries = [
  { label: '이번 달 실제 수입', detail: '판매·수령이 확정된 메소', color: 'text-brand' },
  { label: '이번 달 지출', detail: '구매 및 사용한 메소', color: 'text-expense' },
  { label: '이번 달 순수익', detail: '실제 수입에서 지출을 뺀 금액', color: 'text-ink' }
]

const shortcuts: { page: PageId; icon: IconName; title: string; detail: string }[] = [
  {
    page: 'characters',
    icon: 'characters',
    title: '캐릭터 관리',
    detail: '기록할 캐릭터를 모아보세요'
  },
  { page: 'bosses', icon: 'boss', title: '보스 장부', detail: '클리어부터 판매 정산까지' },
  { page: 'hunting', icon: 'hunting', title: '사냥 장부', detail: '오늘의 사냥을 한 회차씩' }
]

export function DashboardPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-6 rounded-2xl border border-brand/10 bg-brand-soft px-6 py-5">
        <div>
          <p className="text-sm font-semibold text-brand">나의 기록장을 시작해 볼까요?</p>
          <p className="mt-1.5 text-xs leading-5 text-muted">
            캐릭터와 장부 화면을 준비하고 있어요. 현재는 메뉴를 둘러볼 수 있습니다.
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-white/70 px-3 py-2 text-xs text-brand">
          기본 화면 준비 완료
        </span>
      </section>
      <section aria-label="이번 달 수익 요약" className="grid grid-cols-3 gap-4">
        {summaries.map((summary) => (
          <article key={summary.label} className="rounded-2xl border border-line bg-surface p-6">
            <p className="text-xs font-medium text-muted">{summary.label}</p>
            <p className={`my-5 text-3xl font-semibold tabular-nums ${summary.color}`}>
              <span aria-label="기록 없음">—</span>
              <span className="ml-2 text-xs font-normal text-muted">메소</span>
            </p>
            <p className="text-[11px] text-muted">{summary.detail}</p>
          </article>
        ))}
      </section>
      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <section className="rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <h2 className="text-sm font-semibold">수익 흐름</h2>
            <span className="text-[11px] text-muted">기록이 쌓이면 표시됩니다</span>
          </div>
          <EmptyState
            icon="ledger"
            title="아직 수익 기록이 없어요"
            description="보스·사냥 수입과 지출을 기록하면 이곳에서 기간별 흐름을 확인할 수 있습니다."
          />
        </section>
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">기록 바로가기</h2>
          <div className="mt-5 space-y-3">
            {shortcuts.map((item) => (
              <button
                key={item.page}
                type="button"
                onClick={() => onNavigate(item.page)}
                className="group flex w-full items-center gap-3 rounded-xl border border-line p-4 text-left transition hover:border-brand/30 hover:bg-brand-soft"
              >
                <span className="rounded-lg bg-canvas p-2 text-brand">
                  <Icon name={item.icon} />
                </span>
                <div>
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="mt-1 text-[11px] text-muted">{item.detail}</p>
                </div>
                <Icon name="arrow" className="ml-auto size-4 text-muted group-hover:text-brand" />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="rounded-xl border border-dashed border-line px-5 py-4 text-xs leading-5 text-muted">
        <span className="font-semibold text-ink">정산 기준</span>
        <span className="mx-2">·</span>실제 받은 메소와 미판매 아이템의 예상 가치는 따로 기록합니다.
      </div>
    </div>
  )
}
