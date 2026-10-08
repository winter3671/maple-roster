import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import type { NexonStatus } from '../../shared/contracts/nexon.contract'

export interface NexonKeyConfig extends NexonStatus {
  key?: string
}

// Read only this key, without applying .env values to the global environment.
export function readNexonKey(directory: string): NexonKeyConfig {
  try {
    const values = parseEnv(readFileSync(join(directory, '.env'), 'utf8').replace(/^\uFEFF/, ''))
    const key = values.NEXON_API_KEY?.trim()
    if (!key) return { configured: false, issue: 'missing' }
    if (!/^[\x21-\x7e]+$/.test(key) || key.length > 4096)
      return { configured: false, issue: 'invalid' }
    return { configured: true, issue: null, key }
  } catch (error) {
    const missing =
      typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
    return { configured: false, issue: missing ? 'missing' : 'unreadable' }
  }
}
