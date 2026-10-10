import { useState } from 'react'
import { BOSS_ICON_MANIFEST } from '../../../shared/boss-icon-manifest'

const assets = import.meta.glob('../../assets/bosses/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>
const icons = new Map(
  BOSS_ICON_MANIFEST.map((entry) => [JSON.stringify([entry.bossName, entry.difficulty]), entry])
)

export function BossIcon({
  bossName,
  difficulty,
  small = false
}: {
  bossName: string
  difficulty: string
  small?: boolean
}) {
  const entry = icons.get(JSON.stringify([bossName, difficulty]))
  const src = entry ? assets[`../../assets/bosses/${entry.file}`] : undefined
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-lg border border-line bg-canvas ${small ? 'h-10 w-10' : 'h-14 w-14'}`}
    >
      {src && failed !== src ? (
        <img
          src={src}
          alt={`${bossName} ${difficulty}`}
          width={small ? 40 : 56}
          height={small ? 40 : 56}
          className={entry?.badge ? 'h-[76%] w-full object-cover' : 'h-full w-full object-contain'}
          onError={() => setFailed(src)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex w-full items-center justify-center text-xs font-semibold text-muted"
        >
          {bossName.slice(0, 2) || '?'}
        </span>
      )}
      {entry?.badge && src && failed !== src && (
        <span className="absolute inset-x-0 bottom-0 bg-icon-label text-center text-[9px] font-bold leading-4 text-white">
          {difficulty}
        </span>
      )}
    </span>
  )
}
