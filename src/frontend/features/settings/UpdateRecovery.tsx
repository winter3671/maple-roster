import { UpdateManager } from './UpdateManager'

export function UpdateRecovery() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-6 py-12">
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-lg font-semibold">장부를 열려면 앱 업데이트가 필요해요</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          이 장부는 더 새로운 앱에서 사용한 기록입니다. 아래에서 최신 버전을 확인하고 업데이트해
          주세요. 업데이트 전에는 장부를 수정하지 않으며, 적용 전에 장부 파일을 백업합니다.
        </p>
      </section>
      <UpdateManager />
    </main>
  )
}
