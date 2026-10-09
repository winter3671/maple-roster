export const MAX_CHARACTER_IMAGE_URL_LENGTH = 8192
export function characterImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > MAX_CHARACTER_IMAGE_URL_LENGTH)
    return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.href.length <= MAX_CHARACTER_IMAGE_URL_LENGTH &&
      url.hostname === 'open.api.nexon.com' &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith('/static/maplestory/character/look/')
      ? url.href
      : null
  } catch {
    return null
  }
}
