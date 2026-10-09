export interface ImageBounds {
  x: number
  y: number
  width: number
  height: number
}
export function visibleImageBounds(
  pixels: Uint8Array,
  width: number,
  height: number
): ImageBounds | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 2048 ||
    height > 2048 ||
    pixels.length !== width * height * 4
  )
    return null
  let left = width,
    top = height,
    right = -1,
    bottom = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 8) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  if (right < left) return null
  // Keep the API canvas center: a weapon must not recenter the character's body.
  // A 300px API image uses a shared 200px viewport, with room for hats and weapons.
  const padding = 6
  const extent =
    Math.max(
      Math.abs(left - width / 2),
      Math.abs(right + 1 - width / 2),
      Math.abs(top - height / 2),
      Math.abs(bottom + 1 - height / 2)
    ) + padding
  const side = Math.min(
    Math.min(width, height),
    Math.ceil(Math.max((Math.max(width, height) * 2) / 3, extent * 2))
  )
  if (width !== height) return { x: 0, y: 0, width, height }
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    width: side,
    height: side
  }
}
