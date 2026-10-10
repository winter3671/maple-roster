import type { ReactNode } from 'react'
import { Icon } from '../components/ui/Icon'
import { navigation, type PageId } from './navigation'

interface AppLayoutProps {
  page: PageId
  onNavigate: (page: PageId) => void
  children: ReactNode
}

export function AppLayout({ page, onNavigate, children }: AppLayoutProps) {
  const selected = navigation.find((item) => item.id === page)!
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-7">
        <div className="flex items-center gap-3 px-3">
          <span className="rounded-xl bg-brand p-2.5 text-on-brand">
            <Icon name="leaf" className="size-5" />
          </span>
          <div>
            <p className="text-base font-bold tracking-tight">Maple Roster</p>
            <p className="mt-0.5 text-[11px] text-muted">나의 메이플 기록장</p>
          </div>
        </div>
        <p className="mb-3 mt-12 px-4 text-[10px] font-semibold tracking-[0.15em] text-muted">
          WORKSPACE
        </p>
        <nav aria-label="주 메뉴" className="space-y-1.5">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === page ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${item.id === page ? 'bg-brand-soft font-semibold text-brand' : 'text-muted hover:bg-canvas hover:text-ink'}`}
            >
              <Icon name={item.icon} />
              {item.label}
              {item.id === page && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-line p-4">
          <p className="flex items-center gap-2 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-brand" />
            개인용 기록장
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            나의 캐릭터, 나의 플레이.
            <br />
            차곡차곡 쌓이는 기록.
          </p>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="flex h-16 items-center justify-between border-b border-line bg-surface/70 px-9">
          <p className="text-xs text-muted">
            내 기록 <span className="mx-2 text-line">/</span>
            <span className="font-medium text-ink">{selected.label}</span>
          </p>
          <span className="rounded-full border border-line px-3 py-1 text-[11px] text-muted">
            개발 중 · 초기 버전
          </span>
        </div>
        <div className="mx-auto max-w-7xl px-9 py-8">
          <header className="mb-8">
            <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-brand">
              MAPLE ROSTER
            </p>
            <h1 className="text-2xl font-bold tracking-tight">{selected.label}</h1>
            <p className="mt-2 text-sm text-muted">{selected.description}</p>
          </header>
          {children}
          <footer className="mt-10 flex justify-between border-t border-line pt-5 text-[11px] text-muted">
            <span>작은 기록이 모여, 나의 메이플이 됩니다.</span>
            <span>비공식 개인 프로젝트</span>
          </footer>
        </div>
      </main>
    </div>
  )
}
