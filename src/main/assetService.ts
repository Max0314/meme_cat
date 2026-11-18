import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ffmpegStaticPath from 'ffmpeg-static'
import type {
  AppSettings,
  Asset,
  AssetMetadataPatch,
  AssetProvider,
  GreenScreenCacheCleanupResult,
  GreenScreenPreprocessProgress,
  GreenScreenPreprocessRequest,
  GreenScreenPreprocessResult,
  AssetSearchRequest,
  AssetSearchResponse,
  AssetType,
  DownloadAssetRequest,
  RemoteAssetResult,
  VisualKeying,
  WaveformData,
  WorkspaceInfo
} from '../shared/types'
import { assetIndexPath } from './workspace'
import { readJson, withJsonTransaction, writeJson } from './jsonStore'

interface PexelsPhoto {
  id: number
  width: number
  height: number
  url: string
  photographer: string
  src: Record<string, string>
  alt?: string
}

interface PexelsVideo {
  id: number
  width: number
  height: number
  url: string
  duration: number
  image?: string
  user?: { name?: string }
  video_files: Array<{ link: string; quality?: string; width?: number; height?: number; file_type?: string }>
}

interface PixabayHit {
  id: number
  tags?: string
  pageURL: string
  largeImageURL?: string
  webformatURL?: string
  previewURL?: string
  imageWidth?: number
  imageHeight?: number
  user?: string
  videos?: Record<string, { url: string; width: number; height: number; size?: number; thumbnail?: string }>
  duration?: number
}

interface OpenverseResult {
  id: string
  title?: string
  url: string
  foreign_landing_url?: string
  thumbnail?: string
  creator?: string
  license?: string
  license_version?: string
  width?: number
  height?: number
  tags?: Array<{ name: string }>
}

const providerLabel: Record<AssetProvider, string> = {
  local: '本地',
  external: '外部目录',
  pexels: 'Pexels',
  pixabay: 'Pixabay',
  openverse: 'Openverse',
  wikimedia: 'Wikimedia Commons',
  imgflip: 'Imgflip',
  giphy: 'GIPHY',
  knowyourmeme: 'Know Your Meme',
  ai: 'AI'
}

export async function loadAssetIndex(info: WorkspaceInfo): Promise<Asset[]> {
  return withJsonTransaction(assetIndexPath(info), () => loadAssetIndexUnlocked(info))
}

async function loadAssetIndexUnlocked(info: WorkspaceInfo): Promise<Asset[]> {
  const [bundledAssets, workspaceAssets] = await Promise.all([
    loadBundledAssetIndex(),
    readJson<Asset[]>(assetIndexPath(info), [])
  ])
  const mergedAssets = mergeAssetIndexes(bundledAssets, workspaceAssets)
  const reconciled = await reconcileGreenAlphaVariants(info, mergedAssets)
  if (reconciled.changed) {
    await saveAssetIndex(info, reconciled.assets)
  }
  return reconciled.assets.map(withFileUrl)
}

async function saveAssetIndex(info: WorkspaceInfo, assets: Asset[]): Promise<void> {
  const serializable = assets.map(serializeAsset)
  await writeJson(assetIndexPath(info), serializable)
}

export async function updateAssetIndex(info: WorkspaceInfo, update: (assets: Asset[]) => Asset[]): Promise<Asset[]> {
  return withJsonTransaction(assetIndexPath(info), async () => {
    const nextAssets = update(await loadAssetIndexUnlocked(info))
    await saveAssetIndex(info, nextAssets)
    return nextAssets.map(withFileUrl)
  })
}

async function loadBundledAssetIndex(): Promise<Asset[]> {
  const bundledIndexPath = path.join(process.resourcesPath || '', 'seed-data', 'assets.index.json')
  const bundledAssetsRoot = path.join(process.resourcesPath || '', 'seed-assets')
  const assets = await readJson<Asset[]>(bundledIndexPath, [])
  return assets
    .map((asset) => ({
      ...asset,
      localPath: path.join(bundledAssetsRoot, bundledAssetRelativePath(asset)),
      sourceUrl: asset.sourceUrl || 'bundled://asset',
      source: {
        ...asset.source,
        kind: 'bundled' as const
      }
    }))
    .filter((asset) => existsSync(asset.localPath))
}

function mergeAssetIndexes(bundledAssets: Asset[], workspaceAssets: Asset[]): Asset[] {
  const merged = new Map<string, Asset>()
  bundledAssets.forEach((asset) => merged.set(asset.id, asset))
  workspaceAssets.forEach((asset) => {
    const bundled = merged.get(asset.id)
    if (!bundled || existsSync(asset.localPath)) {
      merged.set(asset.id, asset)
    }
  })
  return Array.from(merged.values())
}

function bundledAssetRelativePath(asset: Asset): string {
  const normalizedPath = path.normalize(asset.localPath || '')
  const parts = normalizedPath.split(/[\\/]+/).filter(Boolean)
  const assetsIndex = parts.findIndex((part) => part.toLowerCase() === 'assets')
  if (assetsIndex >= 0 && assetsIndex < parts.length - 1) {
    return path.join(...parts.slice(assetsIndex + 1))
  }

  return asset.filename
}

export function withFileUrl<T extends { localPath?: string }>(value: T): T & { fileUrl?: string } {
  const variants = (value as { processedVariants?: Asset['processedVariants'] }).processedVariants
  return {
    ...value,
    fileUrl: value.localPath ? pathToFileURL(value.localPath).toString() : undefined,
    ...(Array.isArray(variants)
      ? {
          processedVariants: variants.map((variant) => ({
            ...variant,
            fileUrl: pathToFileURL(variant.localPath).toString()
          }))
        }
      : {})
  }
}

export async function updateAssetMetadata(info: WorkspaceInfo, assetId: string, patch: AssetMetadataPatch): Promise<Asset> {
  const assets = await updateAssetIndex(info, (current) => {
    if (!current.some((asset) => asset.id === assetId)) throw new Error('素材不存在')
    return current.map((asset) => asset.id === assetId ? {
      ...asset,
      favorite: patch.favorite ?? asset.favorite,
      lastUsedAt: patch.lastUsedAt ?? asset.lastUsedAt,
      useCount: patch.useCount ?? asset.useCount
    } : asset)
  })
  return assets.find((asset) => asset.id === assetId)!
}

export async function getAssetWaveform(info: WorkspaceInfo, assetId: string): Promise<WaveformData> {
  const assets = await loadAssetIndex(info)
  const asset = assets.find((entry) => entry.id === assetId)
  if (!asset?.localPath || !existsSync(asset.localPath) || !['audio', 'video'].includes(asset.type)) {
    return emptyWaveform(assetId, asset?.duration)
  }

  const sourceInfo = await stat(asset.localPath)
  const cacheDir = path.join(info.dataDir, 'waveforms')
  const cachePath = path.join(cacheDir, `${sanitizeFilename(asset.id)}-${sourceInfo.size}-${Math.round(sourceInfo.mtimeMs)}.json`)
  const cached = await readJson<WaveformData | null>(cachePath, null)
  if (cached?.assetId === assetId && Array.isArray(cached.samples)) return cached

  await mkdir(cacheDir, { recursive: true })
  const waveform = await readAudioSamples(resolveFfmpegPath(), asset.localPath)
    .then((buffer) => analyzeWaveform(assetId, buffer, asset.duration))
    .catch(() => emptyWaveform(assetId, asset.duration))
  await writeJson(cachePath, waveform)
  return waveform
}

export async function cleanupGreenScreenCache(info: WorkspaceInfo): Promise<GreenScreenCacheCleanupResult> {
  return withJsonTransaction(path.join(info.assetsDir, 'processed', 'green-alpha'), () => cleanupGreenScreenCacheUnlocked(info))
}

async function cleanupGreenScreenCacheUnlocked(info: WorkspaceInfo): Promise<GreenScreenCacheCleanupResult> {
  const cacheDir = path.join(info.assetsDir, 'processed', 'green-alpha')
  if (!existsSync(cacheDir)) return { deleted: 0, bytes: 0 }

  const cacheRoot = path.resolve(cacheDir)
  const assets = await loadAssetIndex(info)
  const referenced = new Set(
    assets
      .flatMap((asset) => asset.processedVariants || [])
      .filter((variant) => variant.kind === 'green-alpha')
      .map((variant) => path.resolve(variant.localPath).toLowerCase())
  )

  let deleted = 0
  let bytes = 0
  const entries = await readdir(cacheDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const filePath = path.resolve(cacheDir, entry.name)
    if (!isPathInside(filePath, cacheRoot) || referenced.has(filePath.toLowerCase())) continue
    const fileInfo = await stat(filePath)
    await unlink(filePath)
    deleted += 1
    bytes += fileInfo.size
  }
  return { deleted, bytes }
}

function serializeAsset(asset: Asset): Asset {
  const { fileUrl: _fileUrl, processedVariants, ...rest } = asset
  return {
    ...rest,
    ...(processedVariants?.length
      ? {
          processedVariants: processedVariants.map(({ fileUrl: _variantFileUrl, ...variant }) => variant)
        }
      : {})
  }
}

async function reconcileGreenAlphaVariants(
  info: WorkspaceInfo,
  assets: Asset[]
): Promise<{ assets: Asset[]; changed: boolean }> {
  const outputDir = path.join(info.assetsDir, 'processed', 'green-alpha')
  const defaultKeying = normalizeGreenKeying()
  let changed = false

  const nextAssets = await Promise.all(
    assets.map(async (asset) => {
      const existingVariants = (asset.processedVariants || []).filter((variant) => {
        if (variant.kind !== 'green-alpha') return true
        if (existsSync(variant.localPath)) return true
        changed = true
        return false
      })

      if (!isProcessableGreenAsset(asset) || !existsSync(asset.localPath)) {
        if (existingVariants.length !== (asset.processedVariants || []).length) {
          return { ...asset, processedVariants: existingVariants.length ? existingVariants : undefined }
        }
        return asset
      }

      const format: 'png' | 'webm' = asset.type === 'image' ? 'png' : 'webm'
      const cachePath = path.join(outputDir, `${sanitizeFilename(asset.id)}-green-alpha.${format}`)
      const hasCacheVariant = existingVariants.some((variant) => variant.kind === 'green-alpha' && path.resolve(variant.localPath) === path.resolve(cachePath))
      if (!existsSync(cachePath) || hasCacheVariant) {
        if (existingVariants.length !== (asset.processedVariants || []).length) {
          return { ...asset, processedVariants: existingVariants.length ? existingVariants : undefined }
        }
        return asset
      }

      const [sourceInfo, cacheInfo] = await Promise.all([stat(asset.localPath), stat(cachePath)])
      changed = true
      return {
        ...asset,
        processedVariants: [
          ...existingVariants,
          {
            kind: 'green-alpha' as const,
            format,
            localPath: cachePath,
            sourceMtimeMs: sourceInfo.mtimeMs,
            sourceSize: sourceInfo.size,
            keying: defaultKeying,
            createdAt: cacheInfo.mtime.toISOString(),
            width: asset.width,
            height: asset.height,
            duration: asset.duration
          }
        ]
      }
    })
  )

  return { assets: nextAssets, changed }
}

export async function importLocalAsset(info: WorkspaceInfo, filePath: string): Promise<Asset> {
  const fileInfo = await stat(filePath)
  const type = assetTypeFromExtension(filePath)
  const targetDir = assetDirForType(info, type)
  await mkdir(targetDir, { recursive: true })
  const filename = uniqueFilename(path.basename(filePath))
  const localPath = path.join(targetDir, filename)
  await copyFile(filePath, localPath)

  const asset: Asset = {
    id: crypto.randomUUID(),
    type,
    filename,
    localPath,
    sourceUrl: filePath,
    provider: 'local',
    license: '用户本地导入',
    riskLevel: 'medium',
    tags: ['local'],
    title: path.parse(filePath).name,
    createdAt: new Date(fileInfo.birthtimeMs || Date.now()).toISOString(),
    source: {
      kind: 'managed',
      originalPath: filePath,
      fingerprint: {
        size: fileInfo.size,
        mtimeMs: fileInfo.mtimeMs
      }
    }
  }

  await updateAssetIndex(info, (assets) => [asset, ...assets])
  return withFileUrl(asset)
}

export async function preprocessGreenScreenAssets(
  info: WorkspaceInfo,
  request: GreenScreenPreprocessRequest,
  onProgress?: (progress: GreenScreenPreprocessProgress) => void
): Promise<GreenScreenPreprocessResult> {
  return withJsonTransaction(path.join(info.assetsDir, 'processed', 'green-alpha'), () => preprocessGreenScreenAssetsUnlocked(info, request, onProgress))
}

async function preprocessGreenScreenAssetsUnlocked(
  info: WorkspaceInfo,
  request: GreenScreenPreprocessRequest,
  onProgress?: (progress: GreenScreenPreprocessProgress) => void
): Promise<GreenScreenPreprocessResult> {
  const assets = await loadAssetIndex(info)
  const assetIds = Array.from(new Set(request.assetIds)).filter(Boolean)
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  const keying = normalizeGreenKeying(request.keying)
  const ffmpegPath = resolveFfmpegPath()
  const outputDir = path.join(info.assetsDir, 'processed', 'green-alpha')
  await mkdir(outputDir, { recursive: true })

  let success = 0
  let skipped = 0
  let failed = 0
  const errors: GreenScreenPreprocessResult['errors'] = []

  const emit = (progress: Omit<GreenScreenPreprocessProgress, 'total' | 'success' | 'skipped' | 'failed'>): void => {
    onProgress?.({ total: assetIds.length, success, skipped, failed, ...progress })
  }

  async function processAsset(index: number): Promise<void> {
    const assetId = assetIds[index]
    const asset = assetsById.get(assetId)
    const current = index + 1
    if (!asset) {
      failed += 1
      emit({ current, status: 'failed', assetId, filename: assetId, message: '素材不存在' })
      errors.push({ assetId, filename: assetId, message: '素材不存在' })
      return
    }

    emit({ current, status: 'processing', assetId, filename: asset.filename })
    try {
      if (!isProcessableGreenAsset(asset)) {
        skipped += 1
        emit({ current, status: 'skipped', assetId, filename: asset.filename, message: '非绿幕视觉素材' })
        return
      }

      const sourceInfo = await stat(asset.localPath)
      const existing = findValidGreenAlphaVariant(asset, keying, sourceInfo.size, sourceInfo.mtimeMs)
      if (existing && !request.force) {
        skipped += 1
        emit({ current, status: 'skipped', assetId, filename: asset.filename, message: '已存在透明缓存' })
        return
      }

      const format: 'png' | 'webm' = asset.type === 'image' ? 'png' : 'webm'
      const outputPath = path.join(outputDir, `${sanitizeFilename(asset.id)}-green-alpha.${format}`)
      await runGreenScreenFfmpeg(ffmpegPath, asset.localPath, outputPath, format, keying)
      const visibleBounds = await probeAlphaVisibleBounds(ffmpegPath, outputPath, asset.width, asset.height).catch(() => undefined)

      const variant = {
        kind: 'green-alpha' as const,
        format,
        localPath: outputPath,
        sourceMtimeMs: sourceInfo.mtimeMs,
        sourceSize: sourceInfo.size,
        keying,
        createdAt: new Date().toISOString(),
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        visibleBounds
      }
      asset.processedVariants = [...(asset.processedVariants || []).filter((item) => item.kind !== 'green-alpha'), variant]
      success += 1
      emit({ current, status: 'done', assetId, filename: asset.filename, message: '已生成透明缓存' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failed += 1
      errors.push({ assetId, filename: asset.filename, message })
      emit({ current, status: 'failed', assetId, filename: asset.filename, message })
    }
  }

  let nextIndex = 0
  const workerCount = Math.min(assetIds.length, 2)
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex
        nextIndex += 1
        if (index >= assetIds.length) return
        await processAsset(index)
      }
    })
  )

  const processed = new Map(assets.filter((asset) => assetIds.includes(asset.id)).map((asset) => [asset.id, asset]))
  const savedAssets = await updateAssetIndex(info, (current) => current.map((asset) => {
    const result = processed.get(asset.id)
    return result ? { ...asset, processedVariants: result.processedVariants } : asset
  }))
  return { assets: savedAssets, success, skipped, failed, errors }
}

export async function searchAssets(
  request: AssetSearchRequest,
  settings: AppSettings
): Promise<AssetSearchResponse> {
  const query = normalizeQuery(request.query)
  const warnings: string[] = []
  const providers: AssetProvider[] = request.providers.length
    ? request.providers
    : ['pixabay', 'openverse', 'wikimedia', 'imgflip']
  const limit = Math.max(4, Math.min(request.limit || 24, 80))
  const results: RemoteAssetResult[] = []

  await Promise.all(
    providers.map(async (provider) => {
      try {
        if (provider === 'pexels') {
          results.push(...(await searchPexels(query, request.type, limit, settings, warnings)))
        } else if (provider === 'pixabay') {
          results.push(...(await searchPixabay(query, request.type, limit, settings, warnings)))
        } else if (provider === 'openverse') {
          results.push(...(await searchOpenverse(query, request.type, limit)))
        } else if (provider === 'wikimedia') {
          results.push(...(await searchWikimedia(query, request.type, limit)))
        } else if (provider === 'imgflip') {
          results.push(...(await searchImgflip(query, request.type, limit)))
        } else if (provider === 'giphy' || provider === 'knowyourmeme') {
          results.push(makeExternalInspiration(provider, query))
        }
      } catch (error) {
        warnings.push(`${providerLabel[provider]} 搜索失败：${errorMessage(error)}`)
      }
    })
  )

  return {
    results: dedupeResults(results).slice(0, limit * Math.max(1, providers.length)),
    warnings
  }
}

export async function downloadAsset(info: WorkspaceInfo, request: DownloadAssetRequest): Promise<Asset> {
  const result = request.result
  if (!result.downloadUrl) {
    throw new Error(`${providerLabel[result.provider]} 结果没有可直接下载的媒体地址，请打开来源页面手动确认。`)
  }

  const response = await fetch(result.downloadUrl, {
    headers: {
      'user-agent': 'CatMemeStudio/0.1'
    }
  })

  if (!response.ok) {
    throw new Error(`下载失败：HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  const extension = extensionFromContentType(contentType) || extensionFromUrl(result.downloadUrl) || defaultExtension(result.type)
  const targetDir = assetDirForType(info, result.type)
  await mkdir(targetDir, { recursive: true })
  const filename = uniqueFilename(`${sanitizeFilename(result.title)}.${extension}`)
  const localPath = path.join(targetDir, filename)
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(localPath, buffer)

  const asset: Asset = {
    id: crypto.randomUUID(),
    type: result.type,
    filename,
    localPath,
    sourceUrl: result.sourceUrl,
    provider: result.provider,
    license: result.license,
    riskLevel: result.riskLevel,
    tags: result.tags,
    title: result.title,
    author: result.author,
    duration: result.duration,
    width: result.width,
    height: result.height,
    createdAt: new Date().toISOString()
  }

  await updateAssetIndex(info, (assets) => [asset, ...assets])
  return withFileUrl(asset)
}

async function searchPexels(
  query: string,
  type: AssetSearchRequest['type'],
  limit: number,
  settings: AppSettings,
  warnings: string[]
): Promise<RemoteAssetResult[]> {
  if (!settings.providers.pexelsApiKey) {
    warnings.push('Pexels 需要在设置页填写 API key 后才能搜索。')
    return []
  }

  const headers = { Authorization: settings.providers.pexelsApiKey }
  const results: RemoteAssetResult[] = []

  if (type === 'image' || type === 'all') {
    const data = await fetchJson<{ photos: PexelsPhoto[] }>(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(limit, 40)}&orientation=portrait&locale=zh-CN`,
      headers
    )
    results.push(
      ...data.photos.map((photo) => ({
        id: `pexels-photo-${photo.id}`,
        provider: 'pexels' as const,
        type: 'image' as const,
        title: photo.alt || `Pexels cat photo ${photo.id}`,
        sourceUrl: photo.url,
        downloadUrl: photo.src.large2x || photo.src.original,
        thumbnailUrl: photo.src.medium,
        previewUrl: photo.src.large,
        author: photo.photographer,
        width: photo.width,
        height: photo.height,
        license: 'Pexels License',
        riskLevel: 'safe' as const,
        tags: ['cat', 'pexels'],
        canAutoDownload: true,
        note: 'Pexels API 内容需在界面展示 Pexels 来源链接。'
      }))
    )
  }

  if (type === 'video' || type === 'all') {
    const data = await fetchJson<{ videos: PexelsVideo[] }>(
      `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&per_page=${Math.min(limit, 40)}&orientation=portrait`,
      headers
    )
    results.push(
      ...data.videos.map((video) => {
        const file = pickBestPexelsVideo(video.video_files)
        return {
          id: `pexels-video-${video.id}`,
          provider: 'pexels' as const,
          type: 'video' as const,
          title: `Pexels cat video ${video.id}`,
          sourceUrl: video.url,
          downloadUrl: file?.link,
          thumbnailUrl: video.image,
          previewUrl: video.image,
          author: video.user?.name,
          width: file?.width || video.width,
          height: file?.height || video.height,
          duration: video.duration,
          license: 'Pexels License',
          riskLevel: 'safe' as const,
          tags: ['cat', 'pexels', 'video'],
          canAutoDownload: Boolean(file?.link),
          note: 'Pexels 视频下载后会保存来源页面。'
        }
      })
    )
  }

  return results
}

async function searchPixabay(
  query: string,
  type: AssetSearchRequest['type'],
  limit: number,
  settings: AppSettings,
  warnings: string[]
): Promise<RemoteAssetResult[]> {
  if (!settings.providers.pixabayApiKey) {
    warnings.push('Pixabay 需要在设置页填写 API key 后才能搜索。')
    return []
  }

  const results: RemoteAssetResult[] = []
  const key = settings.providers.pixabayApiKey

  if (type === 'image' || type === 'gif' || type === 'all') {
    const imageType = type === 'gif' ? 'all' : 'photo'
    const data = await fetchJson<{ hits: PixabayHit[] }>(
      `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&image_type=${imageType}&orientation=vertical&per_page=${Math.min(limit, 80)}&safesearch=true`
    )
    results.push(
      ...data.hits.map((hit) => {
        const isGif = /\.gif($|\?)/i.test(hit.largeImageURL || hit.webformatURL || '')
        return {
          id: `pixabay-image-${hit.id}`,
          provider: 'pixabay' as const,
          type: isGif ? ('gif' as const) : ('image' as const),
          title: hit.tags || `Pixabay cat image ${hit.id}`,
          sourceUrl: hit.pageURL,
          downloadUrl: hit.largeImageURL || hit.webformatURL,
          thumbnailUrl: hit.previewURL || hit.webformatURL,
          previewUrl: hit.webformatURL || hit.largeImageURL,
          author: hit.user,
          width: hit.imageWidth,
          height: hit.imageHeight,
          license: 'Pixabay Content License',
          riskLevel: 'safe' as const,
          tags: splitTags(hit.tags, ['cat', 'pixabay']),
          canAutoDownload: Boolean(hit.largeImageURL || hit.webformatURL),
          note: 'Pixabay 内容会保存页面来源和许可证标签。'
        }
      })
    )
  }

  if (type === 'video' || type === 'all') {
    const data = await fetchJson<{ hits: PixabayHit[] }>(
      `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&video_type=film&per_page=${Math.min(limit, 80)}&safesearch=true`
    )
    results.push(
      ...data.hits.map((hit) => {
        const video = hit.videos?.large || hit.videos?.medium || hit.videos?.small || hit.videos?.tiny
        return {
          id: `pixabay-video-${hit.id}`,
          provider: 'pixabay' as const,
          type: 'video' as const,
          title: hit.tags || `Pixabay cat video ${hit.id}`,
          sourceUrl: hit.pageURL,
          downloadUrl: video?.url,
          thumbnailUrl: video?.thumbnail,
          previewUrl: video?.thumbnail,
          author: hit.user,
          width: video?.width,
          height: video?.height,
          duration: hit.duration,
          license: 'Pixabay Content License',
          riskLevel: 'safe' as const,
          tags: splitTags(hit.tags, ['cat', 'pixabay', 'video']),
          canAutoDownload: Boolean(video?.url),
          note: 'Pixabay 视频会保存页面来源和许可证标签。'
        }
      })
    )
  }

  if (type === 'audio' || type === 'all') {
    results.push({
      id: 'pixabay-audio-search',
      provider: 'pixabay',
      type: 'audio',
      title: 'Pixabay 音乐/音效搜索入口',
      sourceUrl: `https://pixabay.com/sound-effects/search/${encodeURIComponent(query)}/`,
      license: 'Pixabay Content License',
      riskLevel: 'safe',
      tags: ['music', 'sfx', 'pixabay'],
      canAutoDownload: false,
      note: 'Pixabay 音频请从来源页面确认后手动导入。'
    })
  }

  return results
}

async function searchOpenverse(
  query: string,
  type: AssetSearchRequest['type'],
  limit: number
): Promise<RemoteAssetResult[]> {
  if (!(type === 'image' || type === 'gif' || type === 'all')) {
    return []
  }

  const data = await fetchJson<{ results: OpenverseResult[] }>(
    `https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(query)}&page_size=${Math.min(limit, 50)}&license_type=commercial,modification`
  )

  return data.results.map((item) => ({
    id: `openverse-${item.id}`,
    provider: 'openverse',
    type: /\.gif($|\?)/i.test(item.url) ? 'gif' : 'image',
    title: item.title || `Openverse ${item.id}`,
    sourceUrl: item.foreign_landing_url || item.url,
    downloadUrl: item.url,
    thumbnailUrl: item.thumbnail || item.url,
    previewUrl: item.thumbnail || item.url,
    author: item.creator,
    width: item.width,
    height: item.height,
    license: [item.license, item.license_version].filter(Boolean).join(' ') || 'Open license',
    riskLevel: 'medium',
    tags: ['openverse', ...((item.tags || []).slice(0, 6).map((tag) => tag.name))],
    canAutoDownload: true,
    note: 'Openverse 提供开放授权索引，但仍建议发布前核验原始页面许可证。'
  }))
}

async function searchWikimedia(
  query: string,
  type: AssetSearchRequest['type'],
  limit: number
): Promise<RemoteAssetResult[]> {
  if (!(type === 'image' || type === 'gif' || type === 'all')) {
    return []
  }

  const categories = ['Category:Lolcats', 'Category:Humorous cats']
  const pages: RemoteAssetResult[] = []

  for (const category of categories) {
    const endpoint =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=categorymembers&gcmtype=file' +
      `&gcmtitle=${encodeURIComponent(category)}&gcmlimit=${Math.min(limit, 50)}` +
      '&prop=imageinfo&iiprop=url%7Cmime%7Csize%7Cextmetadata'
    const data = await fetchJson<{
      query?: {
        pages?: Record<
          string,
          {
            title: string
            imageinfo?: Array<{
              url?: string
              thumburl?: string
              mime?: string
              width?: number
              height?: number
              extmetadata?: Record<string, { value?: string }>
            }>
          }
        >
      }
    }>(endpoint)

    for (const page of Object.values(data.query?.pages || {})) {
      const info = page.imageinfo?.[0]
      if (!info?.url) continue
      const title = page.title.replace(/^File:/, '')
      if (query && !`${title} cat meme lolcat 猫`.toLowerCase().includes(query.toLowerCase())) continue
      const isGif = info.mime === 'image/gif' || /\.gif($|\?)/i.test(info.url)
      pages.push({
        id: `wikimedia-${encodeURIComponent(page.title)}`,
        provider: 'wikimedia',
        type: isGif ? 'gif' : 'image',
        title,
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`,
        downloadUrl: info.url,
        thumbnailUrl: info.thumburl || info.url,
        previewUrl: info.thumburl || info.url,
        author: stripHtml(info.extmetadata?.Artist?.value),
        width: info.width,
        height: info.height,
        license: stripHtml(info.extmetadata?.LicenseShortName?.value) || 'Wikimedia file license',
        riskLevel: 'medium',
        tags: ['wikimedia', 'lolcat', 'cat'],
        canAutoDownload: true,
        note: 'Wikimedia 文件许可证逐文件不同，已保存来源页面。'
      })
    }
  }

  return pages
}

async function searchImgflip(query: string, type: AssetSearchRequest['type'], limit: number): Promise<RemoteAssetResult[]> {
  if (!(type === 'image' || type === 'gif' || type === 'all')) {
    return []
  }
  const data = await fetchJson<{
    success: boolean
    data?: { memes: Array<{ id: string; name: string; url: string; width: number; height: number; box_count: number }> }
    error_message?: string
  }>(`https://api.imgflip.com/get_memes?type=${type === 'gif' ? 'gif' : 'image,gif'}`)

  if (!data.success) {
    throw new Error(data.error_message || 'Imgflip API returned failure')
  }

  const normalizedQuery = query.toLowerCase()
  return (data.data?.memes || [])
    .filter((meme) => {
      if (!normalizedQuery || normalizedQuery === 'cat' || normalizedQuery === '猫') return /cat|kitten|kitty|smudge|bongo|popcat/i.test(meme.name)
      return meme.name.toLowerCase().includes(normalizedQuery)
    })
    .slice(0, limit)
    .map((meme) => ({
      id: `imgflip-${meme.id}`,
      provider: 'imgflip' as const,
      type: /\.gif($|\?)/i.test(meme.url) ? ('gif' as const) : ('image' as const),
      title: meme.name,
      sourceUrl: `https://imgflip.com/memegenerator/${meme.id}`,
      downloadUrl: meme.url,
      thumbnailUrl: meme.url,
      previewUrl: meme.url,
      width: meme.width,
      height: meme.height,
      license: 'Imgflip user-generated meme template; rights may vary',
      riskLevel: 'high' as const,
      tags: ['meme', 'imgflip', 'hot'],
      canAutoDownload: true,
      note: '热梗模板版权不明确，适合个人测试娱乐；商用前请自行确认授权。'
    }))
}

function makeExternalInspiration(provider: 'giphy' | 'knowyourmeme', query: string): RemoteAssetResult {
  const encoded = encodeURIComponent(query || 'cat meme')
  return {
    id: `${provider}-external-${encoded}`,
    provider,
    type: provider === 'giphy' ? 'gif' : 'image',
    title: provider === 'giphy' ? 'GIPHY 猫梗 GIF 灵感入口' : 'Know Your Meme 猫梗资料入口',
    sourceUrl:
      provider === 'giphy'
        ? `https://giphy.com/search/${encoded}`
        : `https://knowyourmeme.com/search?q=${encoded}`,
    license:
      provider === 'giphy'
        ? 'GIPHY content rights vary; personal/non-commercial constraints may apply'
        : 'Know Your Meme content rights vary; downloading/commercial use is restricted',
    riskLevel: 'high',
    tags: ['inspiration', provider],
    canAutoDownload: false,
    note: '根据平台条款，这里只提供外链和灵感入口，不做自动抓取。'
  }
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'CatMemeStudio/0.1',
      ...headers
    }
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

function normalizeQuery(query: string): string {
  const trimmed = query.trim()
  if (!trimmed || trimmed === '猫' || trimmed === '猫猫') return 'cat'
  return trimmed
}

function pickBestPexelsVideo(files: PexelsVideo['video_files']): PexelsVideo['video_files'][number] | undefined {
  return [...files]
    .filter((file) => file.file_type?.includes('mp4') || /\.mp4($|\?)/i.test(file.link))
    .sort((a, b) => {
      const aScore = (a.width || 0) * (a.height || 0)
      const bScore = (b.width || 0) * (b.height || 0)
      return bScore - aScore
    })[0]
}

function dedupeResults(results: RemoteAssetResult[]): RemoteAssetResult[] {
  const seen = new Set<string>()
  return results.filter((result) => {
    const key = `${result.provider}:${result.id}:${result.sourceUrl}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function splitTags(tags: string | undefined, fallback: string[]): string[] {
  const values = (tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return values.length ? values.slice(0, 8) : fallback
}

function stripHtml(value?: string): string | undefined {
  return value?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function assetDirForType(info: WorkspaceInfo, type: AssetType): string {
  if (type === 'video') return path.join(info.assetsDir, 'videos')
  if (type === 'audio') return path.join(info.assetsDir, 'music')
  if (type === 'gif') return path.join(info.assetsDir, 'gifs')
  if (type === 'font') return path.join(info.assetsDir, 'fonts')
  return path.join(info.assetsDir, 'cats')
}

function assetTypeFromExtension(filePath: string): AssetType {
  const ext = path.extname(filePath).toLowerCase()
  if (['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext)) return 'video'
  if (['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext)) return 'audio'
  if (ext === '.gif') return 'gif'
  if (['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) return 'font'
  return 'image'
}

function isProcessableGreenAsset(asset: Asset): boolean {
  if (!['image', 'video', 'gif'].includes(asset.type)) return false
  const haystack = `${asset.filename} ${asset.title || ''} ${(asset.tags || []).join(' ')}`.toLowerCase()
  return haystack.includes('green') || haystack.includes('绿幕') || haystack.includes('chroma') || haystack.includes('抠像')
}

function findValidGreenAlphaVariant(asset: Asset, keying: VisualKeying, sourceSize: number, sourceMtimeMs: number): NonNullable<Asset['processedVariants']>[number] | undefined {
  return asset.processedVariants?.find((variant) => {
    if (variant.kind !== 'green-alpha' || !existsSync(variant.localPath)) return false
    return (
      variant.sourceSize === sourceSize &&
      Math.abs((variant.sourceMtimeMs || 0) - sourceMtimeMs) < 2 &&
      greenKeyingKey(variant.keying) === greenKeyingKey(keying)
    )
  })
}

function normalizeGreenKeying(keying?: Partial<VisualKeying>): VisualKeying {
  return {
    enabled: true,
    color: normalizeKeyingColor(keying?.color || '#00ff00'),
    similarity: clamp(keying?.similarity ?? 0.24, 0.01, 1),
    blend: clamp(keying?.blend ?? 0.08, 0, 1)
  }
}

function normalizeKeyingColor(color: string): string {
  const clean = color.trim().replace(/^0x/i, '#')
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean.toLowerCase()
  if (/^[0-9a-f]{6}$/i.test(clean)) return `#${clean.toLowerCase()}`
  return '#00ff00'
}

function greenKeyingKey(keying?: Partial<VisualKeying>): string {
  const normalized = normalizeGreenKeying(keying)
  return `${normalized.color}:${normalized.similarity.toFixed(3)}:${normalized.blend.toFixed(3)}`
}

function ffmpegKeyingColor(color: string): string {
  return normalizeKeyingColor(color).replace('#', '0x')
}

function resolveFfmpegPath(): string {
  if (!ffmpegStaticPath) throw new Error('FFmpeg 不可用')
  return ffmpegStaticPath.replace('app.asar', 'app.asar.unpacked')
}

function runGreenScreenFfmpeg(ffmpegPath: string, inputPath: string, outputPath: string, format: 'webm' | 'png', keying: VisualKeying): Promise<void> {
  const chromakey = `chromakey=${ffmpegKeyingColor(keying.color)}:${keying.similarity.toFixed(3)}:${keying.blend.toFixed(3)}`
  const args =
    format === 'png'
      ? ['-hide_banner', '-y', '-i', inputPath, '-vf', `${chromakey},format=rgba`, '-frames:v', '1', outputPath]
      : [
          '-hide_banner',
          '-y',
          '-i',
          inputPath,
          '-an',
          '-vf',
          `${chromakey},format=yuva420p`,
          '-c:v',
          'libvpx-vp9',
          '-deadline',
          'realtime',
          '-cpu-used',
          '6',
          '-row-mt',
          '1',
          '-threads',
          '0',
          '-pix_fmt',
          'yuva420p',
          '-auto-alt-ref',
          '0',
          '-b:v',
          '0',
          '-crf',
          '32',
          outputPath
        ]

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        resolve()
      } else {
        reject(new Error(stderr.split(/\r?\n/).filter(Boolean).slice(-4).join(' ') || `FFmpeg 失败：${code}`))
      }
    })
  })
}

function probeAlphaVisibleBounds(
  ffmpegPath: string,
  inputPath: string,
  fallbackWidth?: number,
  fallbackHeight?: number
): Promise<NonNullable<Asset['processedVariants']>[number]['visibleBounds'] | undefined> {
  const args = [
    '-hide_banner',
    '-i',
    inputPath,
    '-vf',
    'alphaextract,cropdetect=limit=0.08:round=2:reset=0',
    '-frames:v',
    '8',
    '-f',
    'null',
    '-'
  ]

  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', () => resolve(undefined))
    child.on('close', () => {
      const sizeMatch = stderr.match(/,\s*(\d{2,5})x(\d{2,5})(?:\s|,|\[)/)
      const width = fallbackWidth || (sizeMatch ? Number(sizeMatch[1]) : 0)
      const height = fallbackHeight || (sizeMatch ? Number(sizeMatch[2]) : 0)
      const crops = Array.from(stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g))
      const crop = crops[crops.length - 1]
      if (!crop || !width || !height) {
        resolve(undefined)
        return
      }
      const cropWidth = Number(crop[1])
      const cropHeight = Number(crop[2])
      const left = Number(crop[3])
      const top = Number(crop[4])
      if (cropWidth <= 0 || cropHeight <= 0 || cropWidth * cropHeight < width * height * 0.0005) {
        resolve(undefined)
        return
      }
      resolve({
        left: clamp(left / width, 0, 1),
        top: clamp(top / height, 0, 1),
        width: clamp(cropWidth / width, 0.02, 1),
        height: clamp(cropHeight / height, 0.02, 1)
      })
    })
  })
}

function readAudioSamples(ffmpegPath: string, inputPath: string): Promise<Buffer> {
  const args = ['-hide_banner', '-i', inputPath, '-vn', '-ac', '1', '-ar', '8000', '-t', '180', '-f', 'f32le', 'pipe:1']
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true })
    const chunks: Buffer[] = []
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 && chunks.length) {
        resolve(Buffer.concat(chunks))
      } else {
        reject(new Error(stderr.split(/\r?\n/).filter(Boolean).slice(-4).join(' ') || `FFmpeg waveform failed: ${code}`))
      }
    })
  })
}

function analyzeWaveform(assetId: string, buffer: Buffer, duration?: number): WaveformData {
  const totalSamples = Math.floor(buffer.length / 4)
  if (!totalSamples) return emptyWaveform(assetId, duration)
  const bucketCount = 96
  const buckets = new Array<number>(bucketCount).fill(0)
  let globalPeak = 0
  let absoluteSum = 0

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket / bucketCount) * totalSamples)
    const end = Math.max(start + 1, Math.floor(((bucket + 1) / bucketCount) * totalSamples))
    let bucketPeak = 0
    for (let index = start; index < end; index += 1) {
      const value = Math.abs(buffer.readFloatLE(index * 4))
      if (!Number.isFinite(value)) continue
      bucketPeak = Math.max(bucketPeak, value)
      globalPeak = Math.max(globalPeak, value)
      absoluteSum += value
    }
    buckets[bucket] = bucketPeak
  }

  const peak = clamp(globalPeak, 0, 1)
  const normalizer = globalPeak > 0 ? globalPeak : 1
  return {
    assetId,
    samples: buckets.map((value) => Number(clamp(value / normalizer, 0, 1).toFixed(3))),
    peak: Number(peak.toFixed(3)),
    mean: Number(clamp(absoluteSum / totalSamples, 0, 1).toFixed(3)),
    duration,
    createdAt: new Date().toISOString()
  }
}

function emptyWaveform(assetId: string, duration?: number): WaveformData {
  return {
    assetId,
    samples: [],
    peak: 0,
    mean: 0,
    duration,
    createdAt: new Date().toISOString()
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function isPathInside(filePath: string, root: string): boolean {
  const relative = path.relative(root, filePath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
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

function extensionFromContentType(contentType: string): string | undefined {
  if (contentType.includes('image/jpeg')) return 'jpg'
  if (contentType.includes('image/png')) return 'png'
  if (contentType.includes('image/gif')) return 'gif'
  if (contentType.includes('image/webp')) return 'webp'
  if (contentType.includes('video/mp4')) return 'mp4'
  if (contentType.includes('video/webm')) return 'webm'
  if (contentType.includes('audio/mpeg')) return 'mp3'
  if (contentType.includes('audio/wav')) return 'wav'
  return undefined
}

function extensionFromUrl(url: string): string | undefined {
  try {
    const ext = path.extname(new URL(url).pathname).replace('.', '').toLowerCase()
    return ext || undefined
  } catch {
    return undefined
  }
}

function defaultExtension(type: AssetType): string {
  if (type === 'video') return 'mp4'
  if (type === 'audio') return 'mp3'
  if (type === 'gif') return 'gif'
  if (type === 'font') return 'ttf'
  return 'jpg'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
