import notes from '../../../shared/release-notes.json'

export function ReleaseNotes({ currentVersion }: { currentVersion?: string }) {
  return (
    <section
      aria-labelledby="release-notes-heading"
      className="rounded-2xl border border-line bg-surface p-6"
    >
      <h2 id="release-notes-heading" className="text-sm font-semibold">
        업데이트 내역
      </h2>
      <p className="mt-3 text-xs leading-6 text-muted">
        이 앱에 포함된 버전별 업데이트 내역입니다. 인터넷 연결 없이 확인할 수 있습니다.
      </p>
      <div className="mt-4 space-y-3">
        {notes.map((note, index) => (
          <details
            key={note.version}
            open={index === 0}
            className="rounded-xl border border-line p-4"
          >
            <summary className="cursor-pointer text-sm font-semibold">
              v{note.version} · {note.title}
              {note.version === currentVersion && (
                <span className="ml-2 rounded-md bg-brand-soft px-2 py-1 text-[11px] font-normal text-brand">
                  현재 버전
                </span>
              )}
            </summary>
            <time dateTime={note.date} className="mt-3 block text-xs text-muted">
              {note.date}
            </time>
            <p className="mt-3 text-sm leading-6">{note.summary}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-6 text-muted">
              {note.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  )
}
