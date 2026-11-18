import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, open, readFile, stat, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
  throw new Error('Stage downloads from a clean release checkout')
}

const { version } = JSON.parse(await readFile('package.json', 'utf8'))
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Expected a stable x.y.z desktop version')
const file = `cat-meme-studio-${version}-windows-x64.exe`
const page = await readFile('site/index.html', 'utf8')
if (!page.includes(`href="/downloads/${file}"`) || !page.includes(`v${version}`)) {
  throw new Error('Update the homepage version text and download links before staging')
}

const source = join('release', `Cat Meme Studio-${version}-portable-x64.exe`)
const { size: bytes } = await stat(source)
const executable = await open(source)
try {
  const signature = Buffer.alloc(2)
  await executable.read(signature, 0, signature.length, 0)
  if (bytes === 0 || signature.toString('ascii') !== 'MZ') throw new Error('Missing Windows executable signature')
} finally {
  await executable.close()
}

const hash = createHash('sha256')
for await (const chunk of createReadStream(source)) hash.update(chunk)
const sha256 = hash.digest('hex')
const manifest = { version, platform: 'windows', arch: 'x64', format: 'portable', sourceSha, file, bytes, sha256 }
const target = join('release-downloads', sourceSha)
await mkdir(target, { recursive: true })
await copyFile(source, join(target, file))
await writeFile(join(target, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await writeFile(join(target, 'SHA256SUMS.txt'), `${sha256}  ${file}\n`)
console.log(JSON.stringify(manifest, null, 2))
