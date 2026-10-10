import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { NexonStatus } from '../../shared/contracts/nexon.contract'
import { AppError } from '../../shared/errors'
import { readId, readObject, readText } from '../../shared/validation'
import type { NexonKeyConfig } from './nexon-key'

export interface KeyCipher {
  available(): boolean
  encrypt(key: string): Buffer
  decrypt(data: Buffer): string
}
interface StoredAccount {
  id: string
  label: string
  key: string
}
interface Vault {
  version: 1
  activeId: string
  accounts: StoredAccount[]
}
const legacyId = '00000000-0000-4000-8000-000000000001'

export class NexonKeyStore {
  private current: NexonKeyConfig
  private saved = false
  private accounts: StoredAccount[] = []
  private activeId: string | null = null
  constructor(
    private readonly file: string,
    private readonly cipher: KeyCipher,
    private readonly development: NexonKeyConfig
  ) {
    this.current = development
    try {
      const size = statSync(file).size
      this.saved = true
      if (!cipher.available() || size <= 0 || size > 524288)
        throw new Error('Unavailable key storage')
      const plaintext = cipher.decrypt(readFileSync(file))
      if (plaintext.startsWith('{')) {
        const raw = readObject(JSON.parse(plaintext))
        if (
          raw.version !== 1 ||
          !Array.isArray(raw.accounts) ||
          raw.accounts.length < 1 ||
          raw.accounts.length > 50
        )
          throw new Error('Invalid key storage')
        const accounts = raw.accounts.map((value) => {
          const row = readObject(value)
          return {
            id: readId(row.id),
            label: this.label(row.label, 30),
            key: this.validate(row.key)
          }
        })
        if (
          new Set(accounts.map((row) => row.id)).size !== accounts.length ||
          new Set(accounts.map((row) => row.label.toLowerCase())).size !== accounts.length ||
          new Set(accounts.map((row) => row.key)).size !== accounts.length
        )
          throw new Error('Invalid key storage')
        const activeId = readId(raw.activeId)
        if (!accounts.some((row) => row.id === activeId)) throw new Error('Invalid active account')
        this.accounts = accounts
        this.activeId = activeId
      } else {
        this.accounts = [{ id: legacyId, label: '기존 계정', key: this.validate(plaintext) }]
        this.activeId = legacyId
      }
      this.refresh()
    } catch (error) {
      const missing =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
      if (!missing) {
        this.accounts = []
        this.activeId = null
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
      encryptionAvailable: this.cipher.available(),
      accounts: this.accounts.map(({ id, label }) => ({ id, label })),
      activeAccountId: this.activeId
    }
  }
  save(value: unknown): NexonStatus {
    if (
      typeof value !== 'string' &&
      (typeof value !== 'object' || value === null || Array.isArray(value))
    )
      this.validate(value)
    // Internal compatibility for callers of the former single-key store.
    if (typeof value === 'string') {
      const key = this.validate(value)
      const current = this.accounts.find((row) => row.id === this.activeId)
      const account = { id: current?.id ?? randomUUID(), label: current?.label ?? '기존 계정', key }
      return this.persist(
        this.accounts.filter((row) => row.id !== account.id).concat(account),
        account.id
      )
    }
    const raw = readObject(value),
      label = this.label(raw.label),
      key = this.validate(raw.key)
    if (this.saved && !this.accounts.length)
      throw new AppError(
        'API_KEY_STORAGE_ERROR',
        '저장된 키 파일을 읽지 못했습니다. 손상된 설정을 삭제한 뒤 다시 등록해 주세요.'
      )
    if (this.accounts.length >= 50)
      throw new AppError('VALIDATION_ERROR', 'API 계정은 최대 50개까지 등록할 수 있습니다.')
    if (this.accounts.some((row) => row.label.toLowerCase() === label.toLowerCase()))
      throw new AppError(
        'VALIDATION_ERROR',
        '이미 등록된 계정 이름입니다. 다른 이름을 입력해 주세요.'
      )
    if (this.accounts.some((row) => row.key === key))
      throw new AppError(
        'VALIDATION_ERROR',
        '이미 등록된 API 키입니다. 목록에서 해당 계정을 선택해 주세요.'
      )
    const account = { id: randomUUID(), label, key }
    return this.persist([...this.accounts, account], this.activeId ?? account.id)
  }
  activate(value: unknown): NexonStatus {
    const id = readId(value)
    this.require(id)
    return this.persist(this.accounts, id)
  }
  rename(value: unknown): NexonStatus {
    const raw = readObject(value),
      id = readId(raw.id),
      label = this.label(raw.label)
    this.require(id)
    if (
      this.accounts.some((row) => row.id !== id && row.label.toLowerCase() === label.toLowerCase())
    )
      throw new AppError(
        'VALIDATION_ERROR',
        '이미 등록된 계정 이름입니다. 다른 이름을 입력해 주세요.'
      )
    return this.persist(
      this.accounts.map((row) => (row.id === id ? { ...row, label } : row)),
      this.activeId!
    )
  }
  remove(value?: unknown): NexonStatus {
    if (value !== undefined) {
      const id = readId(value)
      this.require(id)
      const remaining = this.accounts.filter((row) => row.id !== id)
      if (remaining.length)
        return this.persist(remaining, this.activeId === id ? remaining[0].id : this.activeId!)
    }
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
    this.accounts = []
    this.activeId = null
    this.saved = false
    this.current = this.development
    return this.status()
  }
  private persist(accounts: StoredAccount[], activeId: string): NexonStatus {
    const temporary = `${this.file}.${randomUUID()}.tmp`
    try {
      if (!this.cipher.available()) throw new Error('Encryption unavailable')
      const vault: Vault = { version: 1, activeId, accounts }
      const encrypted = this.cipher.encrypt(JSON.stringify(vault))
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
    this.accounts = accounts
    this.activeId = activeId
    this.saved = true
    this.refresh()
    return this.status()
  }
  private refresh() {
    const key = this.accounts.find((row) => row.id === this.activeId)?.key
    this.current = key ? { configured: true, issue: null, key } : this.development
  }
  private require(id: string) {
    if (!this.accounts.some((row) => row.id === id))
      throw new AppError(
        'VALIDATION_ERROR',
        'API 계정을 찾을 수 없습니다. 설정을 다시 열어 주세요.'
      )
  }
  private label(value: unknown, maxLength = 15): string {
    return readText(value, '계정 이름', maxLength).normalize('NFC')
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
