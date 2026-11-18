import { existsSync, type Dirent } from 'node:fs'
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  Asset,
  AssetLibraryScanResult,
  AssetLibrarySource,
  AssetMetadataPatch,
  AssetSourceFingerprint,
  AssetType,
  WorkspaceInfo
} from '../shared/types'
import { assetLibrariesPath, externalAssetIndexPath } from './workspace'
import { loadAssetIndex, updateAssetIndex } from './assetService'
import { readJson, withJsonTransaction, writeJson } from './jsonStore'
import { isPathInside } from './pathSafety'

const MAX_WARNINGS = 24
const IGNORED_FILES = new Set(['thumbs.db', '.ds_store'])
const IGNORED_DIRS = new Set(['.git', 'node_modules', '$recycle.bin', 'system volume information'])

interface ScannedFile {
  filePath: string
  relativePath: string
  type: AssetType
  size: number
  mtimeMs: number
  birthtimeMs: number
}

export async function loadAssetLibraries(info: WorkspaceInfo): Promise<AssetLibrarySource[]> {
  const sources = await readJson<AssetLibrarySource[]>(assetLibrariesPath(info), [])
  return sources.map(normalizeAssetLibrarySource).filter(Boolean) as AssetLibrarySource[]
}

export async function addAssetLibrary(info: WorkspaceInfo, rootPath: string): Promise<AssetLibraryScanResult> {
  return withJsonTransaction(assetLibrariesPath(info), () => addAssetLibraryUnlocked(info, rootPath))
}

async function addAssetLibraryUnlocked(info: WorkspaceInfo, rootPath: string): Promise<AssetLibraryScanResult> {
  const resolvedRoot = path.resolve(rootPath)
  const rootInfo = await stat(resolvedRoot)
  if (!rootInfo.isDirectory()) throw new Error('请选择素材文件夹')

  const sources = await loadAssetLibraries(info)
  validateExternalLibraryRoot(info, resolvedRoot, sources)

  const source: AssetLibrarySource = {
    id: crypto.randomUUID(),
    name: path.basename(resolvedRoot) || resolvedRoot,
    rootPath: resolvedRoot,
    enabled: true,
    defaultUseMode: 'copy-on-use',
    createdAt: new Date().toISOString()
  }
  await saveAssetLibraries(info, [...sources, source])
  return scanAssetLibraryUnlocked(info, source.id)
}

export async function removeAssetLibrary(info: WorkspaceInfo, libraryId: string): Promise<AssetLibrarySource[]> {
  return withJsonTransaction(assetLibrariesPath(info), () => removeAssetLibraryUnlocked(info, libraryId))
}

async function removeAssetLibraryUnlocked(info: WorkspaceInfo, libraryId: string): Promise<AssetLibrarySource[]> {
  const sources = await loadAssetLibraries(info)
  const nextSources = sources.filter((source) => source.id !== libraryId)
  await saveAssetLibraries(info, nextSources)

  const externalAssets = await readJson<Asset[]>(externalAssetIndexPath(info), [])
  await writeJson(
    externalAssetIndexPath(info),
    externalAssets.filter((asset) => asset.source?.libraryId !== libraryId)
  )
  return nextSources
}

export async function scanAssetLibrary(info: WorkspaceInfo, libraryId: string): Promise<AssetLibraryScanResult> {
  return withJsonTransaction(assetLibrariesPath(info), () => scanAssetLibraryUnlocked(info, libraryId))
}

async function scanAssetLibraryUnlocked(info: WorkspaceInfo, libraryId: string): Promise<AssetLibraryScanResult> {
  const sources = await loadAssetLibraries(info)
  const source = sources.find((item) => item.id === libraryId)
  if (!source) throw new Error('外部素材库不存在')

  const externalAssets = await readJson<Asset[]>(externalAssetIndexPath(info), [])
  const existingForLibrary = externalAssets.filter((asset) => asset.source?.libraryId === libraryId)
  const otherAssets = externalAssets.filter((asset) => asset.source?.libraryId !== libraryId)
  const warnings: string[] = []

  if (!existsSync(source.rootPath)) {
    const offlineAssets = existingForLibrary.map((asset) => ({ ...asset, availability: 'offline' as const }))
    const nextSource = { ...source, lastScanError: '素材库目录不可用' }
    await saveAssetLibraries(info, sources.map((item) => (item.id === source.id ? nextSource : item)))
    await writeJson(externalAssetIndexPath(info), [...otherAssets, ...offlineAssets])
    return {
      source: nextSource,
      assets: offlineAssets.map(withExternalFileUrl),
      added: 0,
      updated: 0,
      missing: offlineAssets.length,
      skipped: 0,
      warnings: ['素材库目录不可用，已保留上次扫描索引']
    }
  }

  const scanned = await scanFiles(source.rootPath, warnings)
  const existingByRelativePath = new Map(
    existingForLibrary.map((asset) => [normalizeRelativePath(asset.source?.relativePath || path.relative(source.rootPath, asset.localPath)), asset])
  )
  const seen = new Set<string>()
  let added = 0
  let updated = 0

  const scannedAssets = scanned.files.map((file) => {
    const relativeKey = normalizeRelativePath(file.relativePath)
    const existing = existingByRelativePath.get(relativeKey)
    seen.add(relativeKey)
    if (existing && (!sameFingerprint(existing.source?.fingerprint, file) || existing.availability !== 'available')) updated += 1
    else if (!existing) added += 1

    const fingerprint: AssetSourceFingerprint = { size: file.size, mtimeMs: file.mtimeMs }
    const tags = deriveDirectoryTags(source, file)
    const asset: Asset = {
      id: existing?.id || crypto.randomUUID(),
      type: file.type,
      filename: path.basename(file.filePath),
      localPath: file.filePath,
      sourceUrl: file.filePath,
      provider: 'external',
      license: existing?.license || '外部目录素材，请自行确认版权',
      riskLevel: existing?.riskLevel || 'medium',
      tags,
      title: existing?.title || path.parse(file.filePath).name,
      createdAt: existing?.createdAt || new Date(file.birthtimeMs || Date.now()).toISOString(),
      favorite: existing?.favorite,
      lastUsedAt: existing?.lastUsedAt,
      useCount: existing?.useCount,
      source: {
        kind: 'external',
        libraryId: source.id,
        rootPath: source.rootPath,
        relativePath: file.relativePath,
        fingerprint
      },
      availability: 'available'
    }
    return asset
  })

  const missingAssets = existingForLibrary
    .filter((asset) => !seen.has(normalizeRelativePath(asset.source?.relativePath || path.relative(source.rootPath, asset.localPath))))
    .map((asset) => ({ ...asset, availability: 'missing' as const }))
  const nextSource = { ...source, lastScannedAt: new Date().toISOString(), lastScanError: undefined }
  const nextSources = sources.map((item) => (item.id === source.id ? nextSource : item))
  const nextAssets = [...otherAssets, ...scannedAssets, ...missingAssets]

  await saveAssetLibraries(info, nextSources)
  await writeJson(externalAssetIndexPath(info), nextAssets)

  return {
    source: nextSource,
    assets: [...scannedAssets, ...missingAssets].map(withExternalFileUrl),
    added,
    updated,
    missing: missingAssets.length,
    skipped: scanned.skipped,
    warnings
  }
}

export async function loadExternalAssetIndex(info: WorkspaceInfo): Promise<Asset[]> {
  const [sources, assets] = await Promise.all([
    loadAssetLibraries(info),
    readJson<Asset[]>(externalAssetIndexPath(info), [])
  ])
  const enabledSources = new Map(sources.filter((source) => source.enabled).map((source) => [source.id, source]))
  return assets
    .filter((asset) => {
      const libraryId = asset.source?.libraryId
      return Boolean(libraryId && enabledSources.has(libraryId))
    })
    .map((asset) => {
      const source = asset.source?.libraryId ? enabledSources.get(asset.source.libraryId) : undefined
      const availability = source && !existsSync(source.rootPath) ? 'offline' : existsSync(asset.localPath) ? 'available' : 'missing'
      return withExternalFileUrl({ ...asset, availability })
    })
}

export async function updateExternalAssetMetadata(
  info: WorkspaceInfo,
  assetId: string,
  patch: AssetMetadataPatch
): Promise<Asset | null> {
  return withJsonTransaction(assetLibrariesPath(info), () => updateExternalAssetMetadataUnlocked(info, assetId, patch))
}

async function updateExternalAssetMetadataUnlocked(info: WorkspaceInfo, assetId: string, patch: AssetMetadataPatch): Promise<Asset | null> {
  const assets = await readJson<Asset[]>(externalAssetIndexPath(info), [])
  const index = assets.findIndex((asset) => asset.id === assetId)
  if (index < 0) return null
  const nextAsset: Asset = {
    ...assets[index],
    favorite: patch.favorite ?? assets[index].favorite,
    lastUsedAt: patch.lastUsedAt ?? assets[index].lastUsedAt,
    useCount: patch.useCount ?? assets[index].useCount
  }
  const nextAssets = [...assets]
  nextAssets[index] = nextAsset
  await writeJson(externalAssetIndexPath(info), nextAssets)
  return withExternalFileUrl(nextAsset)
}

export async function materializeExternalAsset(info: WorkspaceInfo, assetId: string): Promise<Asset> {
  return withJsonTransaction(assetLibrariesPath(info), () => materializeExternalAssetUnlocked(info, assetId))
}

async function materializeExternalAssetUnlocked(info: WorkspaceInfo, assetId: string): Promise<Asset> {
  const externalAssets = await readJson<Asset[]>(externalAssetIndexPath(info), [])
  const sourceAsset = externalAssets.find((asset) => asset.id === assetId)
  if (!sourceAsset || sourceAsset.source?.kind !== 'external') throw new Error('外部素材不存在')
  const sources = await loadAssetLibraries(info)
  const library = sources.find((source) => source.enabled && source.id === sourceAsset.source?.libraryId)
  if (!library || !existsSync(library.rootPath) || !existsSync(sourceAsset.localPath)) {
    throw new Error('外部素材文件不可用，请重新扫描或定位素材库')
  }

  const currentInfo = await stat(sourceAsset.localPath)
  const fingerprint = { size: currentInfo.size, mtimeMs: currentInfo.mtimeMs }
  const workspaceAssets = await loadAssetIndex(info)
  const reusable = workspaceAssets.find(
    (asset) =>
      existsSync(asset.localPath) &&
      asset.source?.kind === 'managed' &&
      asset.source.originalPath === sourceAsset.localPath &&
      sameFingerprint(asset.source.fingerprint, fingerprint)
  )
  if (reusable) return withManagedFileUrl(reusable)

  const targetDir = assetDirForType(info, sourceAsset.type)
  await mkdir(targetDir, { recursive: true })
  const filename = uniqueFilename(sourceAsset.filename)
  const localPath = path.join(targetDir, filename)
  await copyFile(sourceAsset.localPath, localPath)

  const asset: Asset = {
    ...sourceAsset,
    id: crypto.randomUUID(),
    filename,
    localPath,
    sourceUrl: sourceAsset.localPath,
    provider: 'local',
    license: sourceAsset.license || '外部目录素材导入',
    tags: uniqueStrings(['local', 'external-import', ...sourceAsset.tags]),
    createdAt: new Date().toISOString(),
    favorite: undefined,
    lastUsedAt: undefined,
    useCount: undefined,
    processedVariants: undefined,
    availability: 'available',
    source: {
      kind: 'managed',
      originalPath: sourceAsset.localPath,
      libraryId: sourceAsset.source.libraryId,
      rootPath: sourceAsset.source.rootPath,
      relativePath: sourceAsset.source.relativePath,
      fingerprint
    }
  }

  await updateAssetIndex(info, (assets) => [asset, ...assets])
  return withManagedFileUrl(asset)
}

export async function externalAssetLibraryRoots(info: WorkspaceInfo): Promise<string[]> {
  const sources = await loadAssetLibraries(info)
  return sources.filter((source) => source.enabled).map((source) => source.rootPath)
}

async function saveAssetLibraries(info: WorkspaceInfo, sources: AssetLibrarySource[]): Promise<void> {
  await writeJson(assetLibrariesPath(info), sources)
}

function normalizeAssetLibrarySource(source: AssetLibrarySource): AssetLibrarySource | null {
  if (!source?.id || !source.rootPath) return null
  return {
    ...source,
    rootPath: path.resolve(source.rootPath),
    enabled: source.enabled !== false,
    defaultUseMode: source.defaultUseMode || 'copy-on-use',
    createdAt: source.createdAt || new Date().toISOString()
  }
}

function validateExternalLibraryRoot(info: WorkspaceInfo, rootPath: string, sources: AssetLibrarySource[]): void {
  const blockedRoots = [info.assetsDir, info.dataDir, info.projectsDir, info.outputDir].map((root) => path.resolve(root))
  if (blockedRoots.some((blocked) => isPathInside(rootPath, blocked) || isPathInside(blocked, rootPath))) {
    throw new Error('不能把工作区 assets/data/projects/output 作为外部素材库')
  }

  const overlapsExisting = sources.some((source) => {
    const existing = path.resolve(source.rootPath)
    return samePath(existing, rootPath) || isPathInside(rootPath, existing) || isPathInside(existing, rootPath)
  })
  if (overlapsExisting) throw new Error('素材库目录已存在，或与已有素材库嵌套')
}

async function scanFiles(rootPath: string, warnings: string[]): Promise<{ files: ScannedFile[]; skipped: number }> {
  const files: ScannedFile[] = []
  const queue = [rootPath]
  let skipped = 0

  for (let index = 0; index < queue.length; index += 1) {
    const currentDir = queue[index]
    if (!currentDir) continue
    let entries: Dirent[]
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch (error) {
      pushWarning(warnings, `无法读取目录：${currentDir}（${errorText(error)}）`)
      continue
    }

    for (const entry of entries) {
      const entryName = entry.name.toLowerCase()
      if (IGNORED_FILES.has(entryName) || IGNORED_DIRS.has(entryName)) {
        skipped += 1
        continue
      }

      const filePath = path.join(currentDir, entry.name)
      if (entry.isSymbolicLink()) {
        skipped += 1
        continue
      }

      if (entry.isDirectory()) {
        const resolvedDir = path.resolve(filePath)
        if (isPathInside(resolvedDir, rootPath)) queue.push(resolvedDir)
        else skipped += 1
        continue
      }

      if (!entry.isFile()) {
        skipped += 1
        continue
      }

      const type = assetTypeFromExtension(filePath)
      if (!type) {
        skipped += 1
        continue
      }

      try {
        const fileInfo = await stat(filePath)
        files.push({
          filePath,
          relativePath: path.relative(rootPath, filePath),
          type,
          size: fileInfo.size,
          mtimeMs: fileInfo.mtimeMs,
          birthtimeMs: fileInfo.birthtimeMs
        })
      } catch (error) {
        skipped += 1
        pushWarning(warnings, `无法读取文件：${filePath}（${errorText(error)}）`)
      }
    }
  }

  return { files, skipped }
}

function deriveDirectoryTags(source: AssetLibrarySource, file: ScannedFile): string[] {
  const relativeParts = file.relativePath.split(/[\\/]+/).filter(Boolean)
  const directoryParts = relativeParts.slice(0, -1)
  const filenameTokens = path.parse(file.filePath).name.split(/[\s,，、._-]+/).filter(Boolean)
  const typeTags =
    file.type === 'audio'
      ? ['音频']
      : file.type === 'video'
        ? ['视频']
        : file.type === 'gif'
          ? ['GIF']
          : file.type === 'font'
            ? ['字体']
            : ['图片']
  const semanticTags = semanticTagsForText([...directoryParts, ...filenameTokens].join(' '))
  return uniqueStrings(['external', source.name, ...typeTags, ...directoryParts, ...filenameTokens, ...semanticTags]).slice(0, 24)
}

function semanticTagsForText(text: string): string[] {
  const value = text.toLowerCase()
  const tags: string[] = []
  if (['背景', '场景', 'scene', 'background', 'bg', '办公室', '城市', '房间'].some((token) => value.includes(token))) tags.push('背景')
  if (['绿幕', 'green', 'chroma', '抠像'].some((token) => value.includes(token))) tags.push('绿幕')
  if (['角色', '猫', 'cat', 'meme', '香蕉', '哭', '震惊', '开心', '生气'].some((token) => value.includes(token))) tags.push('角色')
  if (['道具', '特效', 'effect', 'props', '闪白', '攻击', '反应'].some((token) => value.includes(token))) tags.push('道具', '特效')
  if (['贴纸', '字幕', '文字', 'emoji', 'caption', '标题', '弹幕'].some((token) => value.includes(token))) tags.push('贴纸')
  if (['bgm', 'music', '背景音乐', '配乐'].some((token) => value.includes(token))) tags.push('BGM', '音乐')
  if (['sfx', '音效', 'sound', '效果'].some((token) => value.includes(token))) tags.push('音效')
  return tags
}

function withExternalFileUrl(asset: Asset): Asset {
  if (asset.availability && asset.availability !== 'available') {
    const { fileUrl: _fileUrl, ...rest } = asset
    return rest
  }
  return asset.localPath && existsSync(asset.localPath) ? { ...asset, fileUrl: pathToFileURL(asset.localPath).toString() } : asset
}

function withManagedFileUrl(asset: Asset): Asset {
  return asset.localPath ? { ...asset, fileUrl: pathToFileURL(asset.localPath).toString() } : asset
}

function assetDirForType(info: WorkspaceInfo, type: AssetType): string {
  if (type === 'video') return path.join(info.assetsDir, 'videos')
  if (type === 'audio') return path.join(info.assetsDir, 'music')
  if (type === 'gif') return path.join(info.assetsDir, 'gifs')
  if (type === 'font') return path.join(info.assetsDir, 'fonts')
  return path.join(info.assetsDir, 'cats')
}

function assetTypeFromExtension(filePath: string): AssetType | null {
  const ext = path.extname(filePath).toLowerCase()
  if (['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext)) return 'video'
  if (['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) return 'audio'
  if (ext === '.gif') return 'gif'
  if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) return 'font'
  if (['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext)) return 'image'
  return null
}

function sanitizeFilename(value: string): string {
  return (value || 'asset')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

function uniqueFilename(filename: string): string {
  const ext = path.extname(filename)
  const base = sanitizeFilename(path.basename(filename, ext))
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}${ext}`
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
}

function normalizeRelativePath(value: string): string {
  return path.normalize(value || '').replace(/\\/g, '/').toLowerCase()
}

function sameFingerprint(a?: AssetSourceFingerprint, b?: AssetSourceFingerprint): boolean {
  return Boolean(a && b && a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) < 2)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function pushWarning(warnings: string[], message: string): void {
  if (warnings.length < MAX_WARNINGS) warnings.push(message)
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
