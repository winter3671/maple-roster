export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_CHARACTER'
  | 'CHARACTER_NOT_FOUND'
  | 'CHARACTER_IN_USE'
  | 'DATABASE_ERROR'
  | 'PERMISSION_DENIED'

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
