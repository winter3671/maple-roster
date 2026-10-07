import { AppError } from './errors'

export function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('VALIDATION_ERROR', '입력 형식을 확인해 주세요.')
  }
  return value as Record<string, unknown>
}

export function readText(
  value: unknown,
  label: string,
  maxLength: number,
  required = true,
  multiline = false
): string {
  if (typeof value !== 'string')
    throw new AppError('VALIDATION_ERROR', `${label} 입력을 확인해 주세요.`)
  const text = value.normalize('NFC').trim()
  if (
    (required && text.length === 0) ||
    text.length > maxLength ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) ||
    (!multiline && /[\r\n\t]/.test(text))
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      `${label}${required ? '은(는) 필수이며' : '은(는)'} ${maxLength}자 이내로 입력해 주세요.`
    )
  }
  return text
}

export function readId(value: unknown): string {
  const id = readText(value, '캐릭터 ID', 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new AppError('VALIDATION_ERROR', '캐릭터 ID를 확인해 주세요.')
  }
  return id
}

export function readInteger(
  value: unknown,
  label: string,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new AppError(
      'VALIDATION_ERROR',
      `${label}은(는) 0 이상 ${maximum.toLocaleString('ko-KR')} 이하의 정수로 입력해 주세요.`
    )
  }
  return value
}
