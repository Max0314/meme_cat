import type { ExportPreset } from './types'

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'douyin-1080p',
    name: '抖音 竖屏高清',
    platform: 'douyin',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: '8000k',
    audioBitrate: '192k',
    coverFrame: 45
  },
  {
    id: 'douyin-landscape-1080p',
    name: '抖音 横屏 1080p',
    platform: 'douyin',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: '10000k',
    audioBitrate: '192k',
    coverFrame: 45
  },
  {
    id: 'kuaishou-1080p',
    name: '快手 竖屏通用',
    platform: 'kuaishou',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: '7000k',
    audioBitrate: '192k',
    coverFrame: 45
  },
  {
    id: 'kuaishou-landscape-1080p',
    name: '快手 横屏 1080p',
    platform: 'kuaishou',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: '9000k',
    audioBitrate: '192k',
    coverFrame: 45
  },
  {
    id: 'xiaohongshu-1080p',
    name: '小红书 竖屏笔记',
    platform: 'xiaohongshu',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: '9000k',
    audioBitrate: '192k',
    coverFrame: 30
  },
  {
    id: 'xiaohongshu-landscape-1080p',
    name: '小红书 横屏视频',
    platform: 'xiaohongshu',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: '10000k',
    audioBitrate: '192k',
    coverFrame: 30
  },
  {
    id: 'bilibili-vertical-1080p',
    name: 'B站 竖屏短片',
    platform: 'bilibili',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: '9000k',
    audioBitrate: '192k',
    coverFrame: 60
  },
  {
    id: 'bilibili-landscape-1080p',
    name: 'B站 横屏 1080p',
    platform: 'bilibili',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: '12000k',
    audioBitrate: '192k',
    coverFrame: 60
  },
  {
    id: 'custom',
    name: '自定义分辨率',
    platform: 'custom',
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: '8000k',
    audioBitrate: '192k',
    coverFrame: 45
  }
]
