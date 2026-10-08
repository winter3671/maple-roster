import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { NexonKeyStore, type KeyCipher } from '../config/nexon-key-store'
import { NexonClient } from '../integrations/nexon/nexon.client'

const directories: string[] = []
const secret = randomBytes(32)
const cipher: KeyCipher = {
  available: () => true,
  encrypt: (key) => {
    const nonce = randomBytes(12),
      aes = createCipheriv('aes-256-gcm', secret, nonce)
    const body = Buffer.concat([aes.update(key, 'utf8'), aes.final()])
    return Buffer.concat([nonce, aes.getAuthTag(), body])
  },
  decrypt: (data) => {
    const aes = createDecipheriv('aes-256-gcm', secret, data.subarray(0, 12))
    aes.setAuthTag(data.subarray(12, 28))
    return Buffer.concat([aes.update(data.subarray(28)), aes.final()]).toString('utf8')
  }
}
const missing = { configured: false, issue: 'missing' as const }
const env = { configured: true, issue: null, key: 'fake-development-key' }
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'maple-key-test-'))
  directories.push(directory)
  return join(directory, 'secrets', 'nexon-api-key.bin')
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    const target = resolve(directory)
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('maple-key-test-'))
      throw new Error('Unsafe cleanup')
    rmSync(target, { recursive: true, force: true })
  }
})

describe('암호화 API 키 저장소', () => {
  it('암호문만 저장하며 재실행에서 복원하고 상태 응답에 키를 노출하지 않는다', () => {
    const file = fixture(),
      store = new NexonKeyStore(file, cipher, env)
    expect(store.status().keySource).toBe('env')
    const status = store.save('fake-saved-key')
    expect(status).toMatchObject({
      configured: true,
      keySource: 'saved',
      hasSavedKey: true,
      encryptionAvailable: true
    })
    expect(JSON.stringify(status)).not.toContain('fake-saved-key')
    expect(readFileSync(file).includes(Buffer.from('fake-saved-key'))).toBe(false)
    expect(new NexonKeyStore(file, cipher, env).getKey()).toBe('fake-saved-key')
    store.save('fake-replacement-key')
    expect(new NexonKeyStore(file, cipher, env).getKey()).toBe('fake-replacement-key')
    expect(store.remove().keySource).toBe('env')
    expect(store.getKey()).toBe(env.key)
    expect(existsSync(file)).toBe(false)
    expect(new NexonKeyStore(file, cipher, missing).getKey()).toBeUndefined()
  })
  it('삭제 후 재실행은 키 누락 상태를 유지하며 반복 삭제도 안전하다', () => {
    const file = fixture(),
      store = new NexonKeyStore(file, cipher, missing)
    store.save('fake-saved-key')
    expect(store.remove()).toMatchObject({ configured: false, hasSavedKey: false, keySource: null })
    expect(store.remove().configured).toBe(false)
    expect(new NexonKeyStore(file, cipher, missing).status().configured).toBe(false)
  })
  it.each(['', '한글키', 'key\nheader', 'x'.repeat(4097), null])(
    '잘못된 키 입력을 거부하고 기존 키를 보존한다',
    (value) => {
      const file = fixture(),
        store = new NexonKeyStore(file, cipher, missing)
      store.save('fake-original-key')
      expect(() => store.save(value)).toThrow('API 키를 확인')
      expect(new NexonKeyStore(file, cipher, missing).getKey()).toBe('fake-original-key')
    }
  )
  it('암호화 실패는 키나 예외 상세를 노출하지 않고 기존 키를 보존한다', () => {
    const file = fixture(),
      broken = { ...cipher, encrypt: vi.fn(cipher.encrypt) }
    const store = new NexonKeyStore(file, broken, missing)
    store.save('fake-original-key')
    broken.encrypt.mockImplementation(() => {
      throw new Error('fake-secret-error-detail')
    })
    expect(() => store.save('fake-replacement-key')).toThrow('기존 설정은 유지')
    expect(() => store.save('fake-replacement-key')).not.toThrow('fake-secret-error-detail')
    expect(store.getKey()).toBe('fake-original-key')
    expect(new NexonKeyStore(file, cipher, missing).getKey()).toBe('fake-original-key')
  })
  it('암호화 불가 시 평문 저장을 하지 않는다', () => {
    const file = fixture(),
      store = new NexonKeyStore(file, { ...cipher, available: () => false }, env)
    expect(store.status().encryptionAvailable).toBe(false)
    expect(() => store.save('fake-saved-key')).toThrow('암호화해 저장하지 못했습니다')
    expect(existsSync(file)).toBe(false)
    expect(store.getKey()).toBe(env.key)
  })
  it('손상된 저장 키는 개발용 키로 조용히 대체하지 않고 복구할 수 있다', () => {
    const file = fixture()
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, 'corrupt-ciphertext')
    const store = new NexonKeyStore(file, cipher, env)
    expect(store.status()).toMatchObject({
      configured: false,
      issue: 'unreadable',
      hasSavedKey: true
    })
    expect(store.getKey()).toBeUndefined()
    store.save('fake-new-key')
    expect(store.getKey()).toBe('fake-new-key')
  })
  it('파일 저장 실패도 기존 메모리 설정을 유지한다', () => {
    const file = fixture()
    mkdirSync(file, { recursive: true })
    const store = new NexonKeyStore(file, cipher, env)
    expect(() => store.save('fake-key')).toThrow('기존 설정은 유지')
    expect(store.getKey()).toBeUndefined()
    expect(store.status().issue).toBe('unreadable')
  })
  it('앱 재시작 없이 다음 요청에 변경 키를 사용하고 삭제 후 요청을 차단한다', async () => {
    const store = new NexonKeyStore(fixture(), cipher, missing)
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response('{"account_list":[]}'))
    const client = new NexonClient(() => store.getKey(), transport, 0)
    store.save('fake-first-key')
    await client.list()
    store.save('fake-second-key')
    await client.list()
    expect(transport.mock.calls.map(([, options]) => options?.headers)).toEqual([
      { 'x-nxopen-api-key': 'fake-first-key' },
      { 'x-nxopen-api-key': 'fake-second-key' }
    ])
    store.remove()
    await expect(client.list()).rejects.toMatchObject({ code: 'API_KEY_MISSING' })
    expect(transport).toHaveBeenCalledTimes(2)
  })
})
