import { readFileSync, writeFileSync } from 'node:fs'

try {
  const args = process.argv.slice(2)
  const packageInfo = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const version = args[0]?.startsWith('--') || !args.length ? packageInfo.version : args.shift()
  let output
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--output')
      throw new Error('Usage: release-notes.mjs [version] [--output file]')
    output = args[1]
  }
  const notes = JSON.parse(
    readFileSync(new URL('../src/shared/release-notes.json', import.meta.url), 'utf8')
  )
  if (!Array.isArray(notes) || !notes.length)
    throw new Error('Release notes must contain at least one release')
  const seen = new Set()
  let previous
  for (const note of notes) {
    if (!/^\d+\.\d+\.\d+$/.test(note.version) || seen.has(note.version))
      throw new Error('Release versions must be unique stable versions')
    seen.add(note.version)
    const parts = note.version.split('.').map(Number)
    if (previous) {
      const difference = parts
        .map((part, index) => part - previous[index])
        .find((value) => value !== 0)
      if (difference === undefined || difference > 0)
        throw new Error('Release notes must be ordered newest first')
    }
    previous = parts
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(note.date) ||
      !Number.isFinite(Date.parse(note.date)) ||
      new Date(note.date).toISOString().slice(0, 10) !== note.date
    )
      throw new Error('Invalid release date')
    if (![note.title, note.summary].every((value) => typeof value === 'string' && value.trim()))
      throw new Error('Release title and summary must not be empty')
    const validChanges = (changes) =>
      Array.isArray(changes) &&
      changes.length > 0 &&
      changes.every((value) => typeof value === 'string' && value.trim() && !/[\r\n]/.test(value))
    if (note.sections !== undefined) {
      if (
        note.changes !== undefined ||
        !Array.isArray(note.sections) ||
        !note.sections.length ||
        !note.sections.every(
          (section) =>
            section &&
            typeof section.title === 'string' &&
            section.title.trim() &&
            !/[\r\n]/.test(section.title) &&
            validChanges(section.changes)
        ) ||
        new Set(note.sections.map((section) => section.title)).size !== note.sections.length
      )
        throw new Error(
          'Each release section needs a unique title and nonempty, single-line changes'
        )
    } else if (!validChanges(note.changes)) {
      throw new Error('Each release needs nonempty, single-line change descriptions')
    }
  }
  const note = notes.find((entry) => entry.version === version)
  if (!note)
    throw new Error(`Release notes are missing for v${version}. Add them before publishing.`)
  const body = note.sections
    ? note.sections
        .map(
          (section) =>
            `## ${section.title}\n\n${section.changes.map((change) => `- ${change}`).join('\n')}`
        )
        .join('\n\n')
    : note.changes.map((change) => `- ${change}`).join('\n')
  const markdown = `# Maple Roster v${note.version} — ${note.title}\n\n${note.date}\n\n${note.summary}\n\n${body}\n`
  if (output) writeFileSync(output, markdown, 'utf8')
  else process.stdout.write(markdown)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not generate release notes')
  process.exitCode = 1
}
