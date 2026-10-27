// Cube item purchase prices are deliberately excluded.
// Equipment appraisal fee estimate for items above Lv.120: required level² × 20.
// In-game calibration supplied by the user: Lv.200 Memento Bronze Additional Cube = 800,000 mesos.
// User policy: Lv.1–120 defaults to zero; any actual low-level fee is entered manually.
const families = new Set([
  '브론즈에디셔널큐브',
  '실버큐브',
  '골드큐브',
  '에디셔널큐브',
  '화이트에디셔널큐브',
  '레드큐브',
  '블랙큐브',
  '장인의큐브',
  '명장의큐브',
  '수상한큐브',
  '수상한에디셔널큐브'
])
export function cubeFamily(name: string): string | null {
  const compact = name
    .normalize('NFC')
    .replace(/\s/g, '')
    .replace(/\((메멘토|카르마)\)/g, '$1')
    .replace(/\[(메멘토|카르마)\]/g, '$1')
    .replace(/\(\d{1,3}제\)$/, '')
    .replace(/^(?:(?:메멘토|카르마|이벤트링전용|대적자의))+/, '')
  return families.has(compact) ? compact : null
}
export function cubeUsageFee(name: string, level: number | null): number | null {
  if (!cubeFamily(name) || level === null || !Number.isInteger(level) || level < 1 || level > 300)
    return null
  if (level <= 120) return 0
  return level * level * 20
}
