import type { Asset } from '../../shared/types'

export function readAudioDuration(asset: Asset): Promise<number> {
  if (asset.duration && Number.isFinite(asset.duration) && asset.duration > 0) return Promise.resolve(asset.duration)
  return new Promise((resolve, reject) => {
    const media = document.createElement('audio')
    media.preload = 'metadata'
    const finish = (duration?: number): void => {
      window.clearTimeout(timeout)
      media.onloadedmetadata = null
      media.onerror = null
      media.removeAttribute('src')
      media.load()
      if (duration && Number.isFinite(duration) && duration > 0) resolve(duration)
      else reject(new Error('配音已生成并保留在素材库，但无法读取音频时长，请从素材库手动使用'))
    }
    const timeout = window.setTimeout(() => finish(), 10000)
    media.onloadedmetadata = () => finish(media.duration)
    media.onerror = () => finish()
    media.src = asset.fileUrl || window.catMeme.toFileUrl(asset.localPath)
    media.load()
  })
}
