/**
 * _bump.cjs — smart version bump following homefinance convention
 *
 * Prefix rules (same as homefinance):
 *   feat:     → MINOR bump  (X.Y+1.0)   new feature
 *   fix:      → PATCH bump  (X.Y.Z+1)   bug fix
 *   refactor: → PATCH bump               code cleanup
 *   style:    → PATCH bump               UI-only change
 *   docs:     → PATCH bump               documentation
 *   (none)    → PATCH bump               default
 *   breaking: → MAJOR bump  (X+1.0.0)   breaking change
 *
 * Usage:  node _bump.cjs "feat: Daily Mission + AI character progression"
 *         node _bump.cjs "fix: assessment skip button blocked during feedback"
 *         node _bump.cjs "breaking: rework auth flow"
 * Output: prints new version e.g. 1.5.0
 */

const fs   = require('fs')
const path = require('path')

const versionFile = path.join(__dirname, 'src', 'lib', 'version.ts')
const content     = fs.readFileSync(versionFile, 'utf8')

// ── Parse current version ─────────────────────────────────────────────────────
const verMatch = content.match(/APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/)
if (!verMatch) { console.error('ERROR: Cannot find APP_VERSION in version.ts'); process.exit(1) }

let [, major, minor, patch] = verMatch.map(Number)

// ── Detect bump type from prefix ─────────────────────────────────────────────
const rawDesc = process.argv[2] || 'fix: Bug fixes and improvements'
const prefix  = rawDesc.split(':')[0].toLowerCase().trim()

let bumpType
if (prefix === 'breaking' || prefix === 'break') {
  bumpType = 'MAJOR';  major++;  minor = 0;  patch = 0
} else if (prefix === 'feat' || prefix === 'feature') {
  bumpType = 'MINOR';  minor++;  patch = 0
} else {
  bumpType = 'PATCH';  patch++
}

const newVersion  = `${major}.${minor}.${patch}`
const today       = new Date().toISOString().split('T')[0]
const versionName = rawDesc.replace(/'/g, "\\'")

// ── Update version.ts ─────────────────────────────────────────────────────────
let updated = content
  .replace(/APP_VERSION = '\d+\.\d+\.\d+'/, `APP_VERSION = '${newVersion}'`)
  .replace(/APP_VERSION_NAME = '[^']*'/,    `APP_VERSION_NAME = '${versionName}'`)
  .replace(/BUILD_DATE = '\d{4}-\d{2}-\d{2}'/, `BUILD_DATE = '${today}'`)
  .replace(
    /export const CHANGELOG: VersionEntry\[\] = \[/,
    `export const CHANGELOG: VersionEntry[] = [\n  { version: '${newVersion}', name: '${versionName}', date: '${today}' },`
  )

fs.writeFileSync(versionFile, updated, 'utf8')

// ── Print summary ─────────────────────────────────────────────────────────────
const old = verMatch.slice(1, 4).join('.')
process.stderr.write(`  ${bumpType} bump: v${old} → v${newVersion}  [${prefix}:]\n`)
console.log(newVersion)
