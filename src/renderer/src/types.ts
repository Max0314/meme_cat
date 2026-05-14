import type { Asset, AssetSearchRequest, TimelineItem, TrackGroupId, TrackKind, VisibleBounds } from '../../shared/types'
export type { VisibleBounds } from '../../shared/types'

export type AssetPrimaryCategory = 'all' | 'background' | 'character' | 'green-screen' | 'audio' | 'props' | 'sticker'
export type AssetSortMode = 'recent' | 'name' | 'duration' | 'type' | 'usage'
export type AssetViewMode = 'grid' | 'list'
export type TrackGroupFilter = TrackGroupId | 'all'
export type EditorToolId = 'select' | 'razor' | 'text' | 'sticker' | 'audio' | 'animate'
export type MemeActionId = 'punch-in' | 'side-hop' | 'shake' | 'flash' | 'repeat' | 'flip-x' | 'flip-y' | 'reset'
export type TransformHandleId = 'move' | 'scale-nw' | 'scale-ne' | 'scale-sw' | 'scale-se' | 'rotate'

export interface TrackGroupDefinition {
  id: TrackGroupId
  label: string
  shortLabel: string
  output: 'visual' | 'audio' | 'subtitle'
}

export interface AssetCategory {
  id: AssetPrimaryCategory
  label: string
  description: string
}

export interface AssetSubcategory {
  id: string
  label: string
  tokens: string[]
  exactTags?: string[]
}

export interface LocalAssetFilter {
  query: string
  primaryCategory: AssetPrimaryCategory
  subCategory: string
  typeFilter: AssetSearchRequest['type']
  sortMode: AssetSortMode
}

export type RightTab = 'templates' | 'roles' | 'script' | 'export' | 'settings'
export type SubtitleSyncMode = 'replace' | 'from-playhead' | 'append'
export type SubtitleTimingMode = 'auto' | 'fixed' | 'even'
export type SubtitleStyleScope = 'all' | 'selected' | 'future'

export interface TimelineContextMenu {
  itemId: string
  x: number
  y: number
}

export interface ContextInputDialog {
  itemId: string
  kind: 'name' | 'subtitle'
  x: number
  y: number
  value: string
}

export interface TimelineLookup {
  trackOrder: Map<string, number>
  timelineOrder: Map<string, number>
  assetsById: Map<string, Asset>
  visibleTrackIdsByScope: Map<TrackGroupId | 'all', Set<string>>
  visualItems: TimelineItem[]
  previewAudioItems: TimelineItem[]
  itemsByType: Map<TrackKind, TimelineItem[]>
}
