import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const directory = fileURLToPath(new URL('../out/renderer/', import.meta.url))
try {
  const manifest = JSON.parse(readFileSync(join(directory, '.vite', 'manifest.json'), 'utf8'))
  const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry)
  const initial = new Set()
  function visit(key) {
    if (initial.has(key)) return
    if (!manifest[key]) throw new Error('Invalid build manifest')
    initial.add(key)
    for (const dependency of manifest[key].imports ?? []) visit(dependency)
  }
  for (const entry of entries) visit(entry)
  const files = (keys) => [
    ...new Set(keys.map((key) => manifest[key].file).filter((file) => file.endsWith('.js')))
  ]
  const size = (file) => statSync(join(directory, file)).size
  const initialFiles = files([...initial])
  console.log(
    JSON.stringify(
      {
        metric: 'renderer-built-javascript',
        initialBytes: initialFiles.reduce((sum, file) => sum + size(file), 0),
        initialFiles,
        totalBytes: files(Object.keys(manifest)).reduce((sum, file) => sum + size(file), 0),
        deferredEntries: Object.values(manifest)
          .filter((chunk) => chunk.isDynamicEntry)
          .map((chunk) => chunk.file)
      },
      null,
      2
    )
  )
} catch (error) {
  console.error('빌드 결과를 확인하지 못했습니다. npm run build 후 다시 실행하세요.', error.message)
  process.exitCode = 1
}
