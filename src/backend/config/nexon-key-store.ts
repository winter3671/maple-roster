import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { NexonStatus } from '../../shared/contracts/nexon.contract'
import { AppError } from '../../shared/errors'
import type { NexonKeyConfig } from './nexon-key'

export interface KeyCipher {
  available(): boolean
  encrypt(key: string): Buffer
  decrypt(data: Buffer): string
}

export class NexonKeyStore {
  private current: NexonKeyConfig
  private saved = false
  constructor(
    private readonly file: string,
    private readonly cipher: KeyCipher,
    private readonly development: NexonKeyConfig
  ) {
    this.current = development
    try {
      const size = statSync(file).size
      this.saved = true
      if (!cipher.available() || size <= 0 || size > 65536)
        throw new Error('Unavailable key storage')
      const key = this.validate(cipher.decrypt(readFileSync(file)))
      this.current = { configured: true, issue: null, key }
    } catch (error) {
      const missing =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
      if (!missing) {
        this.saved = true
        this.current = { configured: false, issue: 'unreadable' }
      }
    }
  }
  getKey(): string | undefined {
    return this.current.key
  }
  status(): NexonStatus {
    return {
      configured: this.current.configured,
      issue: this.current.issue,
      keySource: this.saved ? 'saved' : this.current.configured ? 'env' : null,
      hasSavedKey: this.saved,
      encryptionAvailable: this.cipher.available()
    }
  }
  save(value: unknown): NexonStatus {
    const key = this.validate(value)
    const temporary = `${this.file}.${randomUUID()}.tmp`
    try {
      if (!this.cipher.available()) throw new Error('Encryption unavailable')
      const encrypted = this.cipher.encrypt(key)
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(temporary, encrypted, { flag: 'wx', mode: 0o600 })
      renameSync(temporary, this.file)
    } catch {
      throw new AppError(
        'API_KEY_STORAGE_ERROR',
        'API 키를 암호화해 저장하지 못했습니다. 기존 설정은 유지됩니다.'
      )
    } finally {
      try {
        unlinkSync(temporary)
      } catch {
        /* No temporary file remains after a successful rename. */
      }
    }
    this.saved = true
    this.current = { configured: true, issue: null, key }
    return this.status()
  }
  remove(): NexonStatus {
    try {
      unlinkSync(this.file)
    } catch (error) {
      const missing =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
      if (!missing)
        throw new AppError(
          'API_KEY_STORAGE_ERROR',
          '저장된 API 키를 삭제하지 못했습니다. 기존 설정은 유지됩니다.'
        )
    }
    this.saved = false
    this.current = this.development
    return this.status()
  }
  private validate(value: unknown): string {
    if (typeof value !== 'string' || value.length > 4096 || !/^[\x21-\x7e]+$/.test(value.trim()))
      throw new AppError(
        'VALIDATION_ERROR',
        'API 키를 확인해 주세요. 공백·줄바꿈 없이 발급받은 키를 입력하세요.'
      )
    return value.trim()
  }
}
