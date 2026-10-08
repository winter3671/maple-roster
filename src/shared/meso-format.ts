export function formatKoreanMeso(value: number): string | null {
  if (!Number.isSafeInteger(value) || value < 0) return null
  let remaining = BigInt(value)
  const parts: string[] = []
  for (const [size, unit] of [
    [1000000000000n, '조'],
    [100000000n, '억'],
    [10000n, '만']
  ] as const) {
    const count = remaining / size
    if (count > 0n) parts.push(`${count.toLocaleString('ko-KR')}${unit}`)
    remaining %= size
  }
  if (remaining > 0n || parts.length === 0) parts.push(remaining.toLocaleString('ko-KR'))
  return `${parts.join(' ')} 메소`
}
