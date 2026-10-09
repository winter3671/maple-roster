import { useEffect, useState } from 'react'
import type { Character } from '../../shared/contracts/character.contract'
import { characterImageUrl } from '../../shared/character-image'
import { getBridge } from '../lib/bridge'

export function CharacterAvatar({
  character,
  name,
  size = 'small'
}: {
  character?: Character
  name?: string
  size?: 'small' | 'large'
}) {
  const url = characterImageUrl(character?.nexon?.profile?.imageUrl)
  const imageKey = JSON.stringify([url, character?.nexon?.profile?.fetchedAt])
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null)
  const [image, setImage] = useState<{ key: string; source: string }>()
  useEffect(() => {
    let alive = true
    if (url && character?.id)
      void getBridge()
        .characters.avatar(character.id)
        .then((result) => {
          if (alive && result.ok && result.data) setImage({ key: imageKey, source: result.data })
        })
        .catch(() => {})
    return () => {
      alive = false
    }
  }, [character?.id, imageKey, url])
  const label = name ?? character?.name ?? '캐릭터'
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-brand-soft/40 font-semibold text-brand ${size === 'large' ? 'size-40 text-3xl' : 'size-12 text-sm'}`}
    >
      {image?.key === imageKey && imageKey !== failedImageKey ? (
        <img
          src={image.source}
          alt={`${label} 캐릭터 이미지`}
          className="size-full object-contain"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedImageKey(imageKey)}
        />
      ) : (
        <span aria-hidden="true">{Array.from(label)[0]}</span>
      )}
    </span>
  )
}
