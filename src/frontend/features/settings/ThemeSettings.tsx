import { useId, useState } from 'react'
import { saveTheme, type Theme } from '../../lib/theme'

export function ThemeSettings() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  )
  const [error, setError] = useState(false)
  const id = useId()
  return (
    <section
      className="rounded-2xl border border-line bg-surface p-6"
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className="text-sm font-semibold">
        화면 테마
      </h2>
      <p className="mt-3 text-xs leading-6 text-muted">
        선택한 테마를 바로 적용하고 앱을 다시 실행해도 유지합니다.
      </p>
      <label htmlFor={id} className="mt-4 block text-xs font-semibold">
        테마 선택
      </label>
      <select
        id={id}
        value={theme}
        onChange={(event) => {
          const selected = event.target.value as Theme
          setTheme(selected)
          setError(!saveTheme(selected))
        }}
        className="mt-2 w-full max-w-xs rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink"
      >
        <option value="light">라이트 모드</option>
        <option value="dark">다크 모드</option>
      </select>
      {error && (
        <p role="alert" className="mt-3 text-xs text-expense">
          테마는 적용했지만 설정을 저장하지 못했습니다. 재실행 후에는 다시 선택해 주세요.
        </p>
      )}
    </section>
  )
}
