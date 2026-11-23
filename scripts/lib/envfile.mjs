// Tiny, dependency-free .env file reader for the staging scripts. It exists so the scripts can read a
// staging file that Next never loads by itself (.env.staging.local), and so they can learn which
// variable NAMES a developer's normal .env files define. Values are only ever used, never printed.
import { existsSync, readFileSync } from 'node:fs'

export function parseEnvFile(path) {
  const values = {}
  if (!existsSync(path)) return values
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      line,
    )
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    values[match[1]] = value
  }
  return values
}

// The NAMES (never values) defined by the files a normal developer run would load.
export function inheritedNames(cwd) {
  const names = new Set()
  for (const file of [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.example',
  ])
    for (const name of Object.keys(parseEnvFile(`${cwd}/${file}`)))
      names.add(name)
  return names
}
