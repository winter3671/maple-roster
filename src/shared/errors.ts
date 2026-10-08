export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_CHARACTER'
  | 'CHARACTER_NOT_FOUND'
  | 'CHARACTER_IN_USE'
  | 'DATABASE_ERROR'
  | 'PERMISSION_DENIED'
  | 'SESSION_NOT_FOUND'
  | 'REQUEST_CONFLICT'
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'API_KEY_STORAGE_ERROR'
  | 'API_PERMISSION_DENIED'
  | 'API_RATE_LIMITED'
  | 'API_UNAVAILABLE'
  | 'API_NETWORK_ERROR'
  | 'API_RESPONSE_INVALID'
  | 'BOSS_NOT_FOUND'
  | 'DUPLICATE_BOSS'
  | 'BOSS_ALREADY_SETTLED'
  | 'DROP_NOT_FOUND'
  | 'DROP_IN_USE'
  | 'INSUFFICIENT_DROP_QUANTITY'

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }
