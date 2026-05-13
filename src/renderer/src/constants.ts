import type { AssetSearchRequest, ProjectFile, TimelineEffect } from '../../shared/types'
import type { AssetCategory, AssetSortMode, TrackGroupDefinition } from './types'

export const TRACK_GROUPS: TrackGroupDefinition[] = [
  { id: 'background', label: '背景', shortLabel: 'BG', output: 'visual' },
  { id: 'role', label: '角色', shortLabel: 'V', output: 'visual' },
  { id: 'effect', label: '贴纸/特效', shortLabel: 'FX', output: 'visual' },
  { id: 'subtitle', label: '字幕', shortLabel: 'T', output: 'subtitle' },
  { id: 'bgm', label: 'BGM', shortLabel: 'M', output: 'audio' },
  { id: 'sfx', label: '音效', shortLabel: 'A', output: 'audio' }
]

export const TRACK_GROUP_ORDER = TRACK_GROUPS.map((group) => group.id)
export const TRACK_DRAG_MIME = 'application/x-cat-meme-track'

export const ASSET_PRIMARY_CATEGORIES: AssetCategory[] = [
  { id: 'all', label: '全部', description: '所有图片、视频、GIF、音频' },
  { id: 'background', label: '背景素材', description: '场景、游戏、房间、舞台' },
  { id: 'character', label: '角色 meme', description: '香蕉猫、哭猫、震惊、生气' },
  { id: 'green-screen', label: '绿幕', description: '已加缓存或可加缓存素材' },
  { id: 'audio', label: '音频素材', description: 'BGM、音效、配音、有声视频' },
  { id: 'props', label: '特效/道具', description: '攻击、闪白、表情、道具' },
  { id: 'sticker', label: '字幕/贴纸', description: '贴纸、标题、弹幕风素材' }
]

export const ASSET_TYPE_OPTIONS: Array<{ id: AssetSearchRequest['type']; label: string }> = [
  { id: 'all', label: '全部类型' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'gif', label: 'GIF' },
  { id: 'audio', label: '音频' }
]

export const ASSET_SORT_OPTIONS: Array<{ id: AssetSortMode; label: string }> = [
  { id: 'recent', label: '最近导入' },
  { id: 'name', label: '名称' },
  { id: 'duration', label: '时长' },
  { id: 'type', label: '类型' },
  { id: 'usage', label: '常用优先' }
]

export const ASSET_GRID_PAGE_SIZE = 36
export const ASSET_LIST_PAGE_SIZE = 24

export const DEFAULT_EFFECTS: TimelineEffect[] = [
  { id: 'effect-none', type: 'none', intensity: 0 },
  { id: 'effect-zoom-in', type: 'zoom-in', intensity: 0.25 },
  { id: 'effect-zoom-out', type: 'zoom-out', intensity: 0.2 },
  { id: 'effect-pan-left', type: 'pan-left', intensity: 0.18 },
  { id: 'effect-pan-right', type: 'pan-right', intensity: 0.18 },
  { id: 'effect-shake', type: 'shake', intensity: 0.32 },
  { id: 'effect-flash', type: 'flash', intensity: 0.24 }
]

export const ROLE_COLORS = ['#2563eb', '#f59e0b', '#ec4899', '#10b981', '#7c3aed', '#ef4444']
export const STARTER_ROLE_LINES = ['你先别急', '这件事不对劲', '我有一个大胆的想法']
export const STARTER_ROLE_KEYWORDS = ['绿幕', '猫', '震惊']

export const DEFAULT_ROLE_LABEL_STYLE: ProjectFile['subtitleStyle'] = {
  fontFamily: 'Microsoft YaHei, Microsoft JhengHei, SimHei, Arial, sans-serif',
  fontSize: 36,
  color: '#ffe933',
  outlineColor: '#111111',
  outlineWidth: 3,
  position: 'bottom',
  background: false,
  backgroundColor: '#111827'
}

export const SUBTITLE_STYLE_PRESETS: Array<{ id: string; label: string; style: ProjectFile['subtitleStyle'] }> = [
  {
    id: 'meme-white',
    label: 'B站白字黑边',
    style: {
      fontFamily: 'Microsoft YaHei, Microsoft JhengHei, SimHei, Arial, sans-serif',
      fontSize: 56,
      color: '#ffffff',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 'top',
      background: false,
      backgroundColor: '#111827'
    }
  },
  {
    id: 'narration-bar',
    label: '旁白底条',
    style: {
      fontFamily: 'Microsoft YaHei',
      fontSize: 48,
      color: '#ffffff',
      outlineColor: '#111827',
      outlineWidth: 2,
      position: 'bottom',
      background: true,
      backgroundColor: '#111827'
    }
  },
  {
    id: 'shock-title',
    label: '震惊大字',
    style: {
      fontFamily: 'Microsoft YaHei',
      fontSize: 72,
      color: '#fef08a',
      outlineColor: '#7f1d1d',
      outlineWidth: 6,
      position: 'middle',
      background: false,
      backgroundColor: '#450a0a'
    }
  }
]
