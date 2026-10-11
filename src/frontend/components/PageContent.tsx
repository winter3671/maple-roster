import { Component, Suspense, type ReactNode } from 'react'
import { PageLoading } from './PageLoading'

// Keep navigation available if a local page chunk cannot be loaded.
export class PageContent extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <p
          role="alert"
          className="rounded-xl border border-line bg-surface p-6 text-sm text-expense"
        >
          화면을 불러오지 못했습니다. 앱을 다시 실행해 주세요. 문제가 계속되면 설치파일로 다시
          설치해 주세요.
        </p>
      )
    return <Suspense fallback={<PageLoading />}>{this.props.children}</Suspense>
  }
}
