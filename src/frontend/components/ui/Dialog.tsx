import { useEffect, useId, useRef, type ReactNode } from 'react'

interface DialogProps {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
  wide?: boolean
}

export function Dialog({ title, children, onClose, busy = false, wide = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      className={`m-auto max-h-[90vh] ${wide ? 'w-[min(95vw,800px)]' : 'w-[min(90vw,520px)]'} overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/30`}
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-5">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="닫기"
          className="rounded-md px-2 py-1 text-muted hover:bg-canvas disabled:opacity-50"
        >
          ✕
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  )
}
