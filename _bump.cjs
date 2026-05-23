/**
 * _bump.cjs — auto-bump patch version + set version name
 *
 * Usage:  node _bump.cjs "Version name / change description"
 * Output: prints new version e.g. 1.3.5
 */

const fs = require('fs')
const path = require('path')

const versionFile = path.join(__dirname, 'src', 'lib', 'version.ts')

// ── Read current version ──────────────────────────────────────────────────────
const content = fs.readFileSync(versionFile, 'utf8')

const verMatch = content.match(/APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/)
if (!verMatch) {
  console.error('ERROR: Cannot find APP_VERSION in version.ts')
  process.exit(1)
}

const [, major, minor, patch] = verMatch
const newPatch = parseInt(patch) + 1
const newVersion = `${major}.${minor}.${newPatch}`
const today = new Date().toISOString().split('T')[0]

const versionName = (process.argv[2] || 'Bug fixes and improvements').replace(/'/g, "\\'")

// ── Update APP_VERSION ────────────────────────────────────────────────────────
let updated = content.replace(
  /APP_VERSION = '\d+\.\d+\.\d+'/,
  `APP_VERSION = '${newVersion}'`
)

// ── Update APP_VERSION_NAME ───────────────────────────────────────────────────
updated = updated.replace(
  /APP_VERSION_NAME = '[^']*'/,
  `APP_VERSION_NAME = '${versionName}'`
)

// ── Update BUILD_DATE ─────────────────────────────────────────────────────────
updated = updated.replace(
  /BUILD_DATE = '\d{4}-\d{2}-\d{2}'/,
  `BUILD_DATE = '${today}'`
)

// ── Insert new CHANGELOG entry ────────────────────────────────────────────────
updated = updated.replace(
  /export const CHANGELOG: VersionEntry\[\] = \[/,
  `export const CHANGELOG: VersionEntry[] = [\n  { version: '${newVersion}', name: '${versionName}', date: '${today}' },`
)

fs.writeFileSync(versionFile, updated, 'utf8')

// Print new version for _push.bat to read
console.log(newVersion)
