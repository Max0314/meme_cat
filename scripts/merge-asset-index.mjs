import fs from 'node:fs'
import path from 'node:path'

const [indexPath, additionsPath, mode, ...args] = process.argv.slice(2)

if (!indexPath || !additionsPath || !mode) {
  console.error('Usage: node scripts/merge-asset-index.mjs <index> <additions> <mode> [...args]')
  process.exit(1)
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback
  const raw = fs.readFileSync(filePath, 'utf8').trim()
  return raw ? JSON.parse(raw) : fallback
}

function normalizePath(value) {
  if (!value || /^[a-z]+:\/\//i.test(String(value))) return null
  return path.resolve(String(value)).toLocaleLowerCase()
}

function isInsideAnyRoot(value, roots) {
  const resolved = normalizePath(value)
  if (!resolved) return false
  return roots.some((root) => resolved === root || resolved.startsWith(root + path.sep))
}

const existing = readJson(indexPath, [])
const additions = readJson(additionsPath, [])

let kept
if (mode === 'replace-ids') {
  const ids = new Set(additions.map((asset) => asset.id))
  kept = existing.filter((asset) => !ids.has(asset.id))
} else if (mode === 'replace-managed-roots') {
  const roots = args.map(normalizePath).filter(Boolean)
  kept = existing.filter(
    (asset) => !isInsideAnyRoot(asset.localPath, roots) && !isInsideAnyRoot(asset.sourceUrl, roots)
  )
} else {
  console.error(`Unknown merge mode: ${mode}`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(indexPath), { recursive: true })
fs.writeFileSync(indexPath, `${JSON.stringify([...additions, ...kept], null, 2)}\n`, 'utf8')
