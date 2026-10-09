import type { Character } from '../../shared/contracts/character.contract'
import { characterImageUrl } from '../../shared/character-image'
import { visibleImageBounds, type ImageBounds } from '../../shared/image-bounds'
import { readId } from '../../shared/validation'

interface DecodedImage {
  isEmpty(): boolean
  getSize(): { width: number; height: number }
  toBitmap(): Buffer
  crop(bounds: ImageBounds): { toDataURL(): string }
}
export class CharacterAvatarService {
  private readonly cache = new Map<string, { expires: number; data: string }>()
  private readonly pending = new Map<string, Promise<string | null>>()
  constructor(
    private readonly character: (id: string) => Character | undefined,
    private readonly decode: (data: Buffer) => DecodedImage,
    private readonly transport: typeof fetch = fetch
  ) {}
  async get(value: unknown): Promise<string | null> {
    const character = this.character(readId(value)),
      url = characterImageUrl(character?.nexon?.profile?.imageUrl)
    if (!url) return null
    const key = JSON.stringify([url, character?.nexon?.profile?.fetchedAt]),
      now = Date.now()
    for (const [key, entry] of this.cache) if (entry.expires <= now) this.cache.delete(key)
    const cached = this.cache.get(key)
    if (cached) return cached.data
    const existing = this.pending.get(key)
    if (existing) return existing
    const work = this.load(url)
      .then((data) => {
        if (data) {
          if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!)
          this.cache.set(key, { expires: Date.now() + 5 * 60 * 1000, data })
        }
        return data
      })
      .finally(() => this.pending.delete(key))
    this.pending.set(key, work)
    return work
  }
  private async load(url: string): Promise<string | null> {
    try {
      const response = await this.transport(url, {
        signal: AbortSignal.timeout(10000),
        redirect: 'error'
      })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png'))
        return null
      const limit = 2 * 1024 * 1024
      if (Number(response.headers.get('content-length')) > limit || !response.body) return null
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = []
      let length = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > limit) {
          await reader.cancel()
          return null
        }
        chunks.push(value)
      }
      const image = this.decode(Buffer.concat(chunks))
      if (image.isEmpty()) return null
      const { width, height } = image.getSize()
      if (width > 2048 || height > 2048) return null
      const bounds = visibleImageBounds(image.toBitmap(), width, height)
      return bounds ? image.crop(bounds).toDataURL() : null
    } catch {
      return null
    }
  }
}
