import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, rename, symlink } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { createSourceLoader, fixtureProject } from './test-support.mjs'

const load = createSourceLoader({
  electron: { app: { get isPackaged() { throw new Error('Workspace must be supplied explicitly in tests') } } },
  'node:child_process': { spawn() { throw new Error('Media processes are forbidden in these tests') } },
  'ffmpeg-static': 'unused-ffmpeg'
})
const { readJson, writeJson, withJsonTransaction } = load('src/main/jsonStore.ts')
const { getWorkspaceInfo, assetIndexPath } = load('src/main/workspace.ts')
const { saveProjectFile } = load('src/main/projectService.ts')
const managed = load('src/main/assetService.ts')
const external = load('src/main/assetLibraryService.ts')
const session = load('src/renderer/src/editorSession.ts')
const { isPathInside, resolveAllowedUserPath } = load('src/main/pathSafety.ts')

async function withTemp(action) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'cat-meme-audit-'))
  try { await action(tempRoot) } finally {
    assert.equal(path.dirname(tempRoot), path.resolve(tmpdir()))
    assert.ok(path.basename(tempRoot).startsWith('cat-meme-audit-'))
    await rm(tempRoot, { recursive: true, force: true })
  }
}

test('missing JSON uses defaults; malformed/unreadable JSON is preserved and reported', () => withTemp(async (root) => {
  const file = path.join(root, 'store.json')
  assert.deepEqual(await readJson(file, []), [])
  await writeFile(file, '{broken')
  await assert.rejects(readJson(file, []), /无法读取 JSON/)
  assert.equal(await readFile(file, 'utf8'), '{broken')
  await assert.rejects(readJson(root, []), /无法读取 JSON/)
}))

test('concurrent atomic writes do not share temporary files; transactions retain every update and recover after failure', () => withTemp(async (root) => {
  const file = path.join(root, 'store.json')
  const writes = await Promise.allSettled(Array.from({ length: 16 }, (_, value) => writeJson(file, { value })))
  for (const write of writes) assert.equal(write.status, 'fulfilled', write.reason?.stack)
  assert.equal(typeof (await readJson(file, null)).value, 'number')
  assert.deepEqual(await readdir(root), ['store.json'])
  const original = await readFile(file, 'utf8')
  await assert.rejects(writeJson(file, undefined), /空 JSON/)
  assert.equal(await readFile(file, 'utf8'), original)
  await writeJson(file, 0)
  await Promise.all(Array.from({ length: 20 }, () => withJsonTransaction(file, async () => {
    const previous = await readJson(file, 0)
    await new Promise((resolve) => setImmediate(resolve))
    await writeJson(file, previous + 1)
  })))
  assert.equal(await readJson(file, 0), 20)
  await assert.rejects(withJsonTransaction(file, async () => { throw new Error('expected failure') }))
  assert.equal(await withJsonTransaction(file, async () => 42), 42)
}))

test('same-title projects get separate paths; saving the same identity updates its file without overwriting another project', () => withTemp(async (root) => {
  const info = getWorkspaceInfo(root)
  const [first, second] = await Promise.all([
    saveProjectFile(info, fixtureProject('first')),
    saveProjectFile(info, fixtureProject('second'))
  ])
  assert.notEqual(first.filePath, second.filePath)
  assert.equal((await readJson(first.filePath, null)).id, 'first')
  assert.equal((await readJson(second.filePath, null)).id, 'second')
  const savedAgain = await saveProjectFile(info, { ...second.project, script: '更新' })
  assert.equal(savedAgain.filePath, second.filePath)
  assert.equal((await readJson(first.filePath, null)).script, '')
  await writeFile(first.filePath, '{damaged')
  await assert.rejects(saveProjectFile(info, fixtureProject('third')), /无法读取 JSON/)
  assert.equal(await readFile(first.filePath, 'utf8'), '{damaged')
}))

test('concurrent imports and metadata updates preserve the complete managed index', () => withTemp(async (root) => {
  const info = getWorkspaceInfo(path.join(root, 'workspace'))
  const source = path.join(root, 'sample.png')
  await writeFile(source, 'fixture without real media decoding')
  const imported = await Promise.all(Array.from({ length: 10 }, () => managed.importLocalAsset(info, source)))
  await Promise.all([
    managed.updateAssetMetadata(info, imported[0].id, { favorite: true }),
    managed.updateAssetMetadata(info, imported[0].id, { useCount: 5 }),
    managed.updateAssetMetadata(info, imported[1].id, { favorite: true })
  ])
  const index = await readJson(assetIndexPath(info), [])
  assert.equal(index.length, 10)
  assert.equal(index.find((asset) => asset.id === imported[0].id).favorite, true)
  assert.equal(index.find((asset) => asset.id === imported[0].id).useCount, 5)
  assert.equal(new Set(index.map((asset) => asset.localPath)).size, 10)
}))

test('external library scan/copy/metadata/removal preserve sources; changed files bypass stale copies without a rescan', () => withTemp(async (root) => {
  const info = getWorkspaceInfo(path.join(root, 'workspace'))
  const sourceDir = path.join(root, '素材库', '办公室')
  await mkdir(sourceDir, { recursive: true })
  const sourceFile = path.join(sourceDir, '背景.png')
  await writeFile(sourceFile, 'original')
  await writeFile(path.join(sourceDir, 'ignored.txt'), 'leave alone')
  const scan = await external.addAssetLibrary(info, path.dirname(sourceDir))
  assert.equal(scan.added, 1)
  assert.ok(scan.assets[0].tags.includes('办公室'))
  assert.equal((await external.scanAssetLibrary(info, scan.source.id)).updated, 0)
  const [copy, concurrentCopy, imported] = await Promise.all([
    external.materializeExternalAsset(info, scan.assets[0].id),
    external.materializeExternalAsset(info, scan.assets[0].id),
    managed.importLocalAsset(info, sourceFile)
  ])
  assert.equal(copy.id, concurrentCopy.id)
  assert.notEqual(copy.id, imported.id)
  assert.equal((await readJson(assetIndexPath(info), [])).length, 2)
  await writeFile(sourceFile, 'changed after scanning, with different length')
  const updatedCopy = await external.materializeExternalAsset(info, scan.assets[0].id)
  assert.notEqual(copy.id, updatedCopy.id)
  assert.equal(await readFile(copy.localPath, 'utf8'), 'original')
  assert.equal(await readFile(updatedCopy.localPath, 'utf8'), 'changed after scanning, with different length')
  await Promise.all([
    external.scanAssetLibrary(info, scan.source.id),
    external.updateExternalAssetMetadata(info, scan.assets[0].id, { favorite: true })
  ])
  assert.equal((await external.loadExternalAssetIndex(info))[0].favorite, true)
  const offlineDir = path.join(root, 'offline')
  await rename(path.dirname(sourceDir), offlineDir)
  const offline = await external.scanAssetLibrary(info, scan.source.id)
  assert.equal(offline.assets.length, 1)
  assert.equal(offline.assets[0].availability, 'offline')
  assert.equal(offline.assets[0].fileUrl, undefined)
  await external.removeAssetLibrary(info, scan.source.id)
  assert.equal((await external.loadExternalAssetIndex(info)).length, 0)
  assert.equal(await readFile(path.join(offlineDir, '办公室', '背景.png'), 'utf8'), 'changed after scanning, with different length')
  assert.equal(await readFile(updatedCopy.localPath, 'utf8'), 'changed after scanning, with different length')
}))

test('late save replies preserve intervening edits and a different active project', () => {
  const submitted = fixtureProject()
  const saved = { ...submitted, updatedAt: 'later', workspaceRoot: 'managed-workspace' }
  assert.equal(session.reconcileSavedProject(submitted, submitted, saved).workspaceRoot, 'managed-workspace')
  const edited = { ...submitted, script: 'new edit while saving' }
  assert.equal(session.reconcileSavedProject(edited, submitted, saved), edited)
  const another = fixtureProject('another')
  assert.equal(session.reconcileSavedProject(another, submitted, saved), another)
})

test('parallel green-screen completion does not unlock cleanup early or leave controls stuck', () => {
  const active = { total: 1, current: 1, success: 0, failed: 0, skipped: 0, status: 'processing' }
  assert.equal(session.isGreenScreenProcessing(active), true)
  assert.equal(session.isGreenScreenProcessing({ ...active, total: 2, current: 2, success: 1 }), true)
  assert.equal(session.isGreenScreenProcessing({ ...active, total: 2, current: 1, success: 2, status: 'done' }), false)
})

test('locked tracks reject clip edits/removal/insertion and track deletion while allowing unlock and unrelated edits', () => {
  const before = fixtureProject()
  before.tracks[0].locked = true
  before.timeline = [{ id: 'clip', trackId: before.tracks[0].id, type: 'visual', startFrame: 0, durationFrames: 30, sourceInFrame: 0, label: 'clip', effects: [] }]
  for (const timeline of [[], [...before.timeline, { ...before.timeline[0], id: 'copy' }], [{ ...before.timeline[0], startFrame: 1 }]]) {
    assert.equal(session.changedLockedTrack(before, { ...before, timeline }).id, before.tracks[0].id)
  }
  assert.ok(session.changedLockedTrack(before, { ...before, tracks: [] }))
  assert.equal(session.changedLockedTrack(before, { ...before, title: 'allowed' }), undefined)
  assert.equal(session.changedLockedTrack(before, { ...before, tracks: [{ ...before.tracks[0], locked: false }] }), undefined)
})

test('playback carries fractional frames instead of forcing one frame per timer tick', () => {
  for (const fps of [24, 30, 60, 120]) for (const speed of [0.25, 0.5, 1, 2, 4]) {
    let remainder = 0
    let frames = 0
    for (const elapsed of [...Array(15).fill(66), 10]) {
      const step = session.advancePlayback(elapsed, fps, speed, remainder)
      frames += step.frames
      remainder = step.remainder
    }
    assert.equal(frames, Math.floor(fps * speed), `${fps}fps at ${speed}x`)
  }
})

test('shell path validation accepts legitimate dot-prefixed children and rejects junction escapes', () => withTemp(async (root) => {
  const allowed = path.join(root, 'allowed')
  const outside = path.join(root, 'outside')
  await mkdir(path.join(allowed, '..cats'), { recursive: true })
  await mkdir(outside)
  assert.equal(isPathInside(path.join(allowed, '..cats'), allowed), true)
  assert.equal(isPathInside(outside, allowed), false)
  await symlink(outside, path.join(allowed, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(resolveAllowedUserPath(path.join(allowed, 'escape'), [allowed]), /不允许打开/)
  assert.equal(await resolveAllowedUserPath(path.join(allowed, '..cats'), [allowed]), path.join(allowed, '..cats'))
  await assert.rejects(resolveAllowedUserPath('', [allowed]), /有效/)
}))
