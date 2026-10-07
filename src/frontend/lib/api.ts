import { AppError, type ApiResult } from '../../shared/errors'

export async function unwrap<T>(request: Promise<ApiResult<T>>): Promise<T> {
  const result = await request
  if (!result.ok) throw new AppError(result.error.code, result.error.message)
  return result.data
}
