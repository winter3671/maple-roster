import { join } from 'node:path'

export function dataDirectory(appData: string, packaged: boolean, override?: string): string {
  return override || join(appData, packaged ? 'maple-roster' : 'maple-roster-dev')
}
