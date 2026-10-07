import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon: IconName
  title: string
  description: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center px-8 py-12 text-center">
      <div className="mb-5 rounded-2xl bg-canvas p-4 text-muted">
        <Icon name={icon} className="size-7" />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>
    </div>
  )
}
