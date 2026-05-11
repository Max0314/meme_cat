import {
  Captions,
  FastForward,
  FilePlus2,
  Film,
  Folder,
  FolderOpen,
  GripVertical,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Library,
  Lock,
  Magnet,
  Loader2,
  Mic2,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Rewind,
  Rocket,
  Save,
  Scissors,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  StepBack,
  StepForward,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  Upload
} from 'lucide-react'
import { ChangeEvent, DragEvent, PointerEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type {
  AppSettings,
  Asset,
  AssetProvider,
  GreenScreenPreprocessProgress,
  AssetSearchRequest,
  CatMemeTemplate,
  CharacterMemeState,
  CharacterRole,
  ExportPreset,
  ProjectFile,
  RenderResult,
  TimelineEffect,
  TimelineItem,
  TimelineTrack,
  TrackGroupId,
  TrackKind,
  VisualKeyframe,
  VisualTransform,
  WorkspaceInfo
} from '../../shared/types'

type AssetPrimaryCategory = 'all' | 'background' | 'character' | 'green-screen' | 'audio' | 'props' | 'sticker'
type AssetSortMode = 'recent' | 'name' | 'duration' | 'type' | 'usage'
type AssetViewMode = 'grid' | 'list'
type TrackGroupFilter = TrackGroupId | 'all'

interface TrackGroupDefinition {
  id: TrackGroupId
  label: string
  shortLabel: string
  output: 'visual' | 'audio' | 'subtitle'
}

const TRACK_GROUPS: TrackGroupDefinition[] = [
  { id: 'background', label: '背景', shortLabel: 'BG', output: 'visual' },
  { id: 'role', label: '角色', shortLabel: 'V', output: 'visual' },
  { id: 'effect', label: '贴纸/特效', shortLabel: 'FX', output: 'visual' },
  { id: 'subtitle', label: '字幕', shortLabel: 'T', output: 'subtitle' },
  { id: 'bgm', label: 'BGM', shortLabel: 'M', output: 'audio' },
  { id: 'sfx', label: '音效', shortLabel: 'A', output: 'audio' }
]

const TRACK_GROUP_ORDER = TRACK_GROUPS.map((group) => group.id)
const TRACK_DRAG_MIME = 'application/x-cat-meme-track'

interface AssetCategory {
  id: AssetPrimaryCategory
  label: string
  description: string
}

interface AssetSubcategory {
  id: string
  label: string
  tokens: string[]
  exactTags?: string[]
}

interface LocalAssetFilter {
  query: string
  primaryCategory: AssetPrimaryCategory
  subCategory: string
  typeFilter: AssetSearchRequest['type']
  sortMode: AssetSortMode
}

const ASSET_PRIMARY_CATEGORIES: AssetCategory[] = [
  { id: 'all', label: '全部', description: '所有图片、视频、GIF、音频' },
  { id: 'background', label: '背景素材', description: '场景、游戏、房间、舞台' },
  { id: 'character', label: '角色 meme', description: '香蕉猫、哭猫、震惊、生气' },
  { id: 'green-screen', label: '绿幕', description: '已抠像或可抠像素材' },
  { id: 'audio', label: '音频素材', description: 'BGM、音效、配音、有声视频' },
  { id: 'props', label: '特效/道具', description: '攻击、闪白、表情、道具' },
  { id: 'sticker', label: '字幕/贴纸', description: '贴纸、标题、弹幕风素材' }
]

const ASSET_SUBCATEGORIES: Record<AssetPrimaryCategory, AssetSubcategory[]> = {
  all: [{ id: 'all', label: '全部', tokens: [] }],
  background: [
    { id: 'all', label: '全部背景', tokens: [] },
    { id: 'scene-office', label: '办公室', tokens: [], exactTags: ['办公室'] },
    { id: 'scene-city', label: '城市', tokens: [], exactTags: ['城市'] },
    { id: 'scene-window', label: '窗口', tokens: [], exactTags: ['窗口'] },
    { id: 'scene-ancient', label: '古风', tokens: [], exactTags: ['古风'] },
    { id: 'scene-indoor-building', label: '建筑内', tokens: [], exactTags: ['建筑内'] },
    { id: 'scene-outdoor-building', label: '建筑外', tokens: [], exactTags: ['建筑外'] },
    { id: 'scene-classroom', label: '教室', tokens: [], exactTags: ['教室'] },
    { id: 'scene-street', label: '街道', tokens: [], exactTags: ['街道'] },
    { id: 'scene-real-office', label: '实景--办公室', tokens: [], exactTags: ['实景--办公室'] },
    { id: 'scene-real-car', label: '实景--车内', tokens: [], exactTags: ['实景--车内'] },
    { id: 'scene-real-city', label: '实景--城市', tokens: [], exactTags: ['实景--城市'] },
    { id: 'scene-real-transit', label: '实景--地铁 公交车 车站', tokens: [], exactTags: ['实景--地铁 公交车 车站'] },
    { id: 'scene-real-school', label: '实景--学校', tokens: [], exactTags: ['实景--学校'] },
    { id: 'scene-yard', label: '小院', tokens: [], exactTags: ['小院'] },
    { id: 'scene-school', label: '学校', tokens: [], exactTags: ['学校'] },
    { id: 'scene-wild', label: '野外', tokens: [], exactTags: ['野外'] }
  ],
  character: [
    { id: 'all', label: '全部角色', tokens: [] },
    { id: 'banana-cat', label: '香蕉猫', tokens: ['banana', '香蕉猫', '香蕉'] },
    { id: 'crying-cat', label: '哭猫', tokens: ['cry', '哭', '哭泣', '委屈'] },
    { id: 'shock', label: '震惊', tokens: ['shock', '震惊', '惊讶', '尖叫', '大叫'] },
    { id: 'angry', label: '生气', tokens: ['angry', '生气', '愤怒', '打架'] },
    { id: 'happy', label: '开心', tokens: ['happy', '开心', '搞笑', '笑'] },
    { id: 'dance', label: '跳舞', tokens: ['dance', '跳舞', '动作'] },
    { id: 'life', label: '生活动作', tokens: ['生活', '吃喝', '睡', '动作'] }
  ],
  'green-screen': [
    { id: 'all', label: '全部绿幕', tokens: [] },
    { id: 'character-green', label: '角色绿幕', tokens: ['绿幕', 'green', 'chroma', '角色'] },
    { id: 'sound-green', label: '有声绿幕', tokens: ['绿幕', '有声', '原声', 'sound', 'audio'] },
    { id: 'effect-green', label: '特效绿幕', tokens: ['绿幕', '特效', 'effect'] }
  ],
  audio: [
    { id: 'all', label: '全部音频', tokens: [] },
    { id: 'bgm', label: 'BGM', tokens: ['bgm', 'music', '音乐', '背景音乐'] },
    { id: 'sfx', label: '音效', tokens: ['sfx', '音效', 'sound', '效果'] },
    { id: 'voice', label: '配音', tokens: ['voice', '配音', 'tts', '台词'] },
    { id: 'video-audio', label: '有声视频', tokens: ['有声', '原声', 'audio', 'sound'] }
  ],
  props: [
    { id: 'all', label: '全部道具', tokens: [] },
    { id: 'attack', label: '攻击', tokens: ['攻击', '激光', '剑', '刀', 'laser'] },
    { id: 'flash', label: '闪白', tokens: ['闪白', 'flash'] },
    { id: 'reaction', label: '反应', tokens: ['反应', 'reaction', '表情'] },
    { id: 'object', label: '道具', tokens: ['道具', 'props', '贴纸'] }
  ],
  sticker: [
    { id: 'all', label: '全部贴纸', tokens: [] },
    { id: 'subtitle', label: '字幕', tokens: ['字幕', '文字', 'title'] },
    { id: 'emoji', label: '表情', tokens: ['表情', 'emoji', '贴纸'] },
    { id: 'caption', label: '弹幕/标题', tokens: ['弹幕', '标题', 'caption'] }
  ]
}

const ASSET_TYPE_OPTIONS: Array<{ id: AssetSearchRequest['type']; label: string }> = [
  { id: 'all', label: '全部类型' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'gif', label: 'GIF' },
  { id: 'audio', label: '音频' }
]

const ASSET_SORT_OPTIONS: Array<{ id: AssetSortMode; label: string }> = [
  { id: 'recent', label: '最近导入' },
  { id: 'name', label: '名称' },
  { id: 'duration', label: '时长' },
  { id: 'type', label: '类型' },
  { id: 'usage', label: '常用优先' }
]
const ASSET_GRID_PAGE_SIZE = 36
const ASSET_LIST_PAGE_SIZE = 24
const DEFAULT_EFFECTS: TimelineEffect[] = [
  { id: 'effect-none', type: 'none', intensity: 0 },
  { id: 'effect-zoom-in', type: 'zoom-in', intensity: 0.25 },
  { id: 'effect-zoom-out', type: 'zoom-out', intensity: 0.2 },
  { id: 'effect-pan-left', type: 'pan-left', intensity: 0.18 },
  { id: 'effect-pan-right', type: 'pan-right', intensity: 0.18 },
  { id: 'effect-shake', type: 'shake', intensity: 0.32 },
  { id: 'effect-flash', type: 'flash', intensity: 0.24 }
]
const ROLE_COLORS = ['#2563eb', '#f59e0b', '#ec4899', '#10b981', '#7c3aed', '#ef4444']
const STARTER_ROLE_LINES = ['你先别急', '这件事不对劲', '我有一个大胆的想法']
const STARTER_ROLE_KEYWORDS = ['绿幕', '猫', '震惊']
const SUBTITLE_STYLE_PRESETS: Array<{ id: string; label: string; style: ProjectFile['subtitleStyle'] }> = [
  {
    id: 'meme-white',
    label: 'B站白字黑边',
    style: { fontFamily: 'Microsoft YaHei, Microsoft JhengHei, SimHei, Arial, sans-serif', fontSize: 56, color: '#ffffff', outlineColor: '#000000', outlineWidth: 3, position: 'top', background: false, backgroundColor: '#111827' }
  },
  {
    id: 'narration-bar',
    label: '旁白底条',
    style: { fontFamily: 'Microsoft YaHei', fontSize: 48, color: '#ffffff', outlineColor: '#111827', outlineWidth: 2, position: 'bottom', background: true, backgroundColor: '#111827' }
  },
  {
    id: 'shock-title',
    label: '震惊大字',
    style: { fontFamily: 'Microsoft YaHei', fontSize: 72, color: '#fef08a', outlineColor: '#7f1d1d', outlineWidth: 6, position: 'middle', background: false, backgroundColor: '#450a0a' }
  }
]

type RightTab = 'templates' | 'roles' | 'script' | 'export' | 'settings'
type SubtitleSyncMode = 'replace' | 'from-playhead' | 'append'
type SubtitleTimingMode = 'auto' | 'fixed' | 'even'
type SubtitleStyleScope = 'all' | 'selected' | 'future'
type NormalizedTransform = ReturnType<typeof normalizeTransform>

interface VisibleBounds {
  left: number
  top: number
  width: number
  height: number
}

interface TimelineContextMenu {
  itemId: string
  x: number
  y: number
}

interface ContextInputDialog {
  itemId: string
  kind: 'name' | 'subtitle'
  x: number
  y: number
  value: string
}

const firstVisibleFrameCache = new Map<string, Promise<number>>()

function App(): JSX.Element {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [project, setProject] = useState<ProjectFile | null>(null)
  const [presets, setPresets] = useState<ExportPreset[]>([])
  const [templates, setTemplates] = useState<CatMemeTemplate[]>([])
  const [localAssets, setLocalAssets] = useState<Asset[]>([])
  const [localAssetQuery, setLocalAssetQuery] = useState('')
  const [assetPrimaryCategory, setAssetPrimaryCategory] = useState<AssetPrimaryCategory>('all')
  const [assetSubCategory, setAssetSubCategory] = useState('all')
  const [assetTypeFilter, setAssetTypeFilter] = useState<AssetSearchRequest['type']>('all')
  const [assetSortMode, setAssetSortMode] = useState<AssetSortMode>('recent')
  const [assetViewMode, setAssetViewMode] = useState<AssetViewMode>('grid')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [playheadFrame, setPlayheadFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerSpeed, setPlayerSpeed] = useState(1)
  const [timelineZoom, setTimelineZoom] = useState(1)
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true)
  const [razorMode, setRazorMode] = useState(false)
  const [activeTrackGroup, setActiveTrackGroup] = useState<TrackGroupFilter>('all')
  const [soloTrackGroup, setSoloTrackGroup] = useState<TrackGroupId | null>(null)
  const [toolDrawer, setToolDrawer] = useState<'export' | 'settings' | null>(null)
  const [contextMenu, setContextMenu] = useState<TimelineContextMenu | null>(null)
  const [contextInput, setContextInput] = useState<ContextInputDialog | null>(null)
  const contextInputRef = useRef<HTMLInputElement | null>(null)
  const [manualTotalFrames, setManualTotalFrames] = useState(0)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [clipClipboard, setClipClipboard] = useState<TimelineItem | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('templates')
  const [preview, setPreview] = useState<RenderResult | null>(null)
  const [lastExport, setLastExport] = useState<RenderResult | null>(null)
  const [preprocessProgress, setPreprocessProgress] = useState<GreenScreenPreprocessProgress | null>(null)
  const [busy, setBusy] = useState<string | null>('启动中')
  const [notice, setNotice] = useState('正在初始化应用...')
  const [aiTopic, setAiTopic] = useState('猫猫上班第一天就想离职')
  const [quickSubtitleText, setQuickSubtitleText] = useState('')
  const [quickSubtitleSeconds, setQuickSubtitleSeconds] = useState(2.8)

  useEffect(() => {
    void boot()
  }, [])

  useEffect(() => {
    return window.catMeme.onGreenScreenPreprocessProgress((progress) => {
      setPreprocessProgress(progress)
      setNotice(`透明缓存：${progress.current}/${progress.total}，成功 ${progress.success}，跳过 ${progress.skipped}，失败 ${progress.failed}`)
    })
  }, [])

  const currentPreset = useMemo(() => {
    if (!project) return presets[0]
    if (project.exportPresetId === 'custom') return normalizeCustomPreset(project.customExportPreset)
    return presets.find((preset) => preset.id === project.exportPresetId) || presets[0]
  }, [presets, project])

  const totalFrames = useMemo(() => {
    if (!project || !currentPreset) return 300
    const timelineMax = project.timeline.reduce((max, item) => Math.max(max, item.startFrame + item.durationFrames), 0)
    return Math.max(timelineMax, currentPreset.fps * 10, manualTotalFrames)
  }, [currentPreset, manualTotalFrames, project])

  const selectedItem = useMemo(
    () => project?.timeline.find((item) => item.id === selectedItemId) || null,
    [project, selectedItemId]
  )

  const selectedTrack = useMemo(() => {
    if (!project) return null
    return (
      project.tracks.find((track) => track.id === selectedTrackId) ||
      project.tracks.find((track) => track.id === selectedItem?.trackId) ||
      project.tracks[0] ||
      null
    )
  }, [project, selectedItem, selectedTrackId])

  const contextMenuItem = useMemo(
    () => project?.timeline.find((item) => item.id === contextMenu?.itemId) || null,
    [contextMenu, project]
  )

  const contextInputItem = useMemo(
    () => project?.timeline.find((item) => item.id === contextInput?.itemId) || null,
    [contextInput, project]
  )

  const previewTrackGroup = useMemo<TrackGroupId | null>(
    () => soloTrackGroup || (activeTrackGroup === 'all' ? null : activeTrackGroup),
    [activeTrackGroup, soloTrackGroup]
  )

  const activeVisualItems = useMemo(
    () => findActiveVisualItems(project, playheadFrame, previewTrackGroup),
    [project, playheadFrame, previewTrackGroup]
  )

  const activeSubtitleItem = useMemo(
    () => {
      const item = findActiveItem(project, playheadFrame, 'subtitle')
      if (!item || !previewTrackGroup) return item
      return trackGroupId(project?.tracks.find((track) => track.id === item.trackId)) === previewTrackGroup ? item : null
    },
    [project, playheadFrame, previewTrackGroup]
  )

  const activeAudioItems = useMemo(
    () => findPreviewAudioItems(project, playheadFrame, previewTrackGroup),
    [project, playheadFrame, previewTrackGroup]
  )

  const filteredLocalAssets = useMemo(
    () =>
      filterLocalAssets(localAssets, {
        query: localAssetQuery,
        primaryCategory: assetPrimaryCategory,
        subCategory: assetSubCategory,
        typeFilter: assetTypeFilter,
        sortMode: assetSortMode
      }),
    [assetPrimaryCategory, assetSortMode, assetSubCategory, assetTypeFilter, localAssetQuery, localAssets]
  )

  const assetCategoryCounts = useMemo(
    () =>
      ASSET_PRIMARY_CATEGORIES.reduce(
        (counts, category) => ({ ...counts, [category.id]: countAssetsForCategory(localAssets, category.id) }),
        {} as Record<AssetPrimaryCategory, number>
      ),
    [localAssets]
  )

  async function boot(): Promise<void> {
    try {
      setBusy('启动中')
      const [workspaceInfo, nextSettings, nextPresets, nextTemplates, nextProject, assets] = await Promise.all([
        window.catMeme.workspaceInfo(),
        window.catMeme.getSettings(),
        window.catMeme.listPresets(),
        window.catMeme.listTemplates(),
        window.catMeme.newProject(),
        window.catMeme.listAssets()
      ])
      const normalizedAssets = normalizeAssets(assets)
      setWorkspace(workspaceInfo)
      setSettings(nextSettings)
      setPresets(nextPresets)
      setTemplates(nextTemplates)
      setProject(normalizeProject({ ...nextProject, assets: normalizedAssets }))
      setLocalAssets(normalizedAssets)
      setNotice(`工作区：${workspaceInfo.root}`)
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    if (!isPlaying || !currentPreset) return
    let lastTick = performance.now()
    const interval = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.max(16, now - lastTick)
      lastTick = now
      setPlayheadFrame((frame) => {
        const step = Math.max(1, Math.round((elapsed / 1000) * currentPreset.fps * playerSpeed))
        const nextFrame = Math.min(totalFrames, frame + step)
        if (nextFrame >= totalFrames) {
          window.setTimeout(() => setIsPlaying(false), 0)
        }
        return nextFrame
      })
    }, 66)

    return () => window.clearInterval(interval)
  }, [currentPreset, isPlaying, playerSpeed, totalFrames])

  useEffect(() => {
    if (!project) return
    if (selectedItem?.trackId && selectedTrackId !== selectedItem.trackId) {
      setSelectedTrackId(selectedItem.trackId)
      return
    }
    if (!selectedTrackId || !project.tracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId(project.tracks[0]?.id || null)
    }
  }, [project, selectedItem, selectedTrackId])

  useEffect(() => {
    if (!contextMenu) return
    function closeMenu(event: globalThis.PointerEvent): void {
      if ((event.target as HTMLElement | null)?.closest?.('.timeline-context-menu')) return
      setContextMenu(null)
    }
    function closeOnKey(event: KeyboardEvent): void {
      if (event.code === 'Escape') setContextMenu(null)
    }
    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', closeOnKey)
    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', closeOnKey)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!toolDrawer) return
    function closeOnKey(event: KeyboardEvent): void {
      if (event.code === 'Escape') setToolDrawer(null)
    }
    window.addEventListener('keydown', closeOnKey)
    return () => window.removeEventListener('keydown', closeOnKey)
  }, [toolDrawer])

  useEffect(() => {
    if (!contextInput) return
    window.setTimeout(() => {
      contextInputRef.current?.focus()
      contextInputRef.current?.select()
    }, 0)
  }, [contextInput])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        setIsPlaying((value) => !value)
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'ArrowLeft') {
        event.preventDefault()
        jumpToEdit(-1)
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'ArrowRight') {
        event.preventDefault()
        jumpToEdit(1)
      } else if (event.altKey && event.code === 'ArrowLeft') {
        event.preventDefault()
        nudgeSelectedItem(event.shiftKey ? -10 : -1)
      } else if (event.altKey && event.code === 'ArrowRight') {
        event.preventDefault()
        nudgeSelectedItem(event.shiftKey ? 10 : 1)
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault()
        jumpFrames(event.shiftKey ? -15 : -1)
      } else if (event.code === 'ArrowRight') {
        event.preventDefault()
        jumpFrames(event.shiftKey ? 15 : 1)
      } else if (event.code === 'Home') {
        event.preventDefault()
        setPlayheadFrame(0)
      } else if (event.code === 'End') {
        event.preventDefault()
        setPlayheadFrame(totalFrames)
      } else if (event.code === 'KeyJ') {
        event.preventDefault()
        jumpFrames(event.shiftKey ? -60 : -15)
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK') {
        event.preventDefault()
        cutSelectedOrActiveItemAtPlayhead()
      } else if (event.code === 'KeyK') {
        event.preventDefault()
        setIsPlaying(false)
        setPlayerSpeed(1)
      } else if (event.code === 'KeyL') {
        event.preventDefault()
        setIsPlaying(true)
        setPlayerSpeed((speed) => (isPlaying ? Math.min(4, speed * 2) : Math.max(1, speed)))
      } else if (event.code === 'KeyC' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        setRazorMode(true)
        setNotice('剃刀工具：点击片段即可切开，按 V 返回选择')
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyC') {
        event.preventDefault()
        copySelectedItem()
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyV') {
        event.preventDefault()
        pasteClipboardItem()
      } else if ((event.code === 'KeyS' || event.code === 'KeyB') && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        splitSelectedItem()
      } else if (event.code === 'BracketLeft') {
        event.preventDefault()
        trimSelectedStartToPlayhead()
      } else if (event.code === 'BracketRight') {
        event.preventDefault()
        trimSelectedEndToPlayhead()
      } else if (event.code === 'Delete' || event.code === 'Backspace') {
        event.preventDefault()
        deleteSelectedItem()
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
        event.preventDefault()
        void saveProject()
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyD') {
        event.preventDefault()
        duplicateSelectedItem()
      } else if ((event.ctrlKey || event.metaKey) && (event.code === 'Equal' || event.code === 'NumpadAdd')) {
        event.preventDefault()
        setTimelineZoom((zoom) => clampNumber(zoom * 1.15, 1, 4))
      } else if ((event.ctrlKey || event.metaKey) && (event.code === 'Minus' || event.code === 'NumpadSubtract')) {
        event.preventDefault()
        setTimelineZoom((zoom) => clampNumber(zoom / 1.15, 1, 4))
      } else if (event.code === 'KeyH') {
        event.preventDefault()
        patchSelectedVisualTransform((transform) => ({ flipX: !transform.flipX }))
      } else if (event.code === 'KeyV') {
        event.preventDefault()
        if (razorMode) {
          setRazorMode(false)
          setNotice('已切回选择工具')
        } else {
          patchSelectedVisualTransform((transform) => ({ flipY: !transform.flipY }))
        }
      } else if (event.code === 'KeyR') {
        event.preventDefault()
        patchSelectedVisualTransform((transform) => ({ rotation: transform.rotation + (event.shiftKey ? -15 : 15) }))
      } else if (event.code === 'Digit0') {
        event.preventDefault()
        patchSelectedVisualTransform(() => ({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 }))
      } else if (event.code === 'KeyM') {
        event.preventDefault()
        muteSelectedItem()
      } else if (event.code === 'Escape') {
        event.preventDefault()
        setSelectedItemId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clipClipboard, isPlaying, playheadFrame, project, razorMode, selectedItem, totalFrames])

  async function importLocalAssets(): Promise<void> {
    try {
      setBusy('导入素材')
      const assets = await window.catMeme.importLocalAssets()
      const normalizedAssets = normalizeAssets(assets)
      if (normalizedAssets.length) {
        addAssetsToProject(normalizedAssets)
        setLocalAssets((current) => [...normalizedAssets, ...current])
        setNotice(`已导入 ${normalizedAssets.length} 个素材`)
      }
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  async function preprocessFilteredGreenScreenAssets(force = false): Promise<void> {
    const assetIds = filteredLocalAssets.filter(isGreenScreenAsset).map((asset) => asset.id)
    if (!assetIds.length) {
      setNotice('当前筛选结果没有绿幕素材')
      return
    }
    try {
      setBusy('生成透明缓存')
      setPreprocessProgress({ total: assetIds.length, current: 0, success: 0, skipped: 0, failed: 0, status: 'processing' })
      const result = await window.catMeme.preprocessGreenScreen({
        assetIds,
        force,
        keying: { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 }
      })
      const normalizedAssets = normalizeAssets(result.assets)
      setLocalAssets(normalizedAssets)
      setProject((current) => (current ? { ...current, assets: mergeAssets(current.assets, normalizedAssets), updatedAt: new Date().toISOString() } : current))
      setNotice(`透明缓存完成：成功 ${result.success}，跳过 ${result.skipped}，失败 ${result.failed}`)
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  function addAssetToTimeline(asset: Asset, trackKind: TrackKind = asset.type === 'audio' ? 'music' : 'visual'): void {
    if (!project || !currentPreset) return
    const trackId = trackKind === 'visual' ? trackIdForVisualAsset(project, asset, selectedItem) : trackIdForKind(project, trackKind, selectedItem)
    const startFrame = trackKind === 'visual' ? playheadFrame : nextStartFrame(project, trackId)
    addAssetToTimelineAt(asset, trackId, startFrame)
  }

  function addAssetToPurpose(asset: Asset, purpose: 'background' | 'role' | 'audio'): void {
    if (!project) return
    const visualTracks = project.tracks.filter((track) => track.kind === 'visual')
    if (purpose === 'background') {
      if (!isBackgroundAsset(asset) && isCharacterLikeAsset(asset)) {
        const track = trackByGroupKind(project, 'role', 'visual')
        if (track) addAssetToTimelineAt(asset, track.id, playheadFrame)
        setNotice('这是角色/绿幕素材，已自动放入角色轨')
        return
      }
      const track = project.tracks.find((item) => item.id === backgroundTrackId(project)) || visualTracks[0]
      if (track) addAssetToTimelineAt(asset, track.id, playheadFrame)
      return
    }
    if (purpose === 'role') {
      const track =
        visualTracks.find((item) => item.id.startsWith('visual-role')) ||
        visualTracks.find((item) => item.id !== 'visual-main') ||
        visualTracks[0]
      if (track) addAssetToTimelineAt(asset, track.id, playheadFrame)
      return
    }
    const track = project.tracks.find((item) => item.id === (asset.type === 'audio' ? 'music' : 'sfx')) || project.tracks.find((item) => item.kind === 'sfx' || item.kind === 'music')
    if (track) addAssetToTimelineAt(asset, track.id, nextStartFrame(project, track.id))
  }

  function addAssetToTimelineAt(asset: Asset, trackId: string, startFrame: number, transformOverride?: Partial<ReturnType<typeof normalizeTransform>>): void {
    if (!project || !currentPreset) return
    const requestedTrack = project.tracks.find((track) => track.id === trackId)
    const requestedGroup = trackGroupId(requestedTrack)
    const targetGroup = isVisualAsset(asset) ? visualTargetGroupForAsset(asset) : null
    const resolvedTrackId = targetGroup
      ? targetGroup === 'background'
        ? backgroundTrackId(project)
        : requestedTrack?.kind === 'visual' && requestedGroup !== 'background' && canPlaceAssetOnTrack(asset, requestedTrack.kind)
          ? trackId
          : trackByGroupKind(project, targetGroup, 'visual')?.id || trackId
      : trackId
    const track = project.tracks.find((track) => track.id === resolvedTrackId)
    if (!track) return
    if (track.locked) {
      setNotice(`${displayTrackName(track)} 已锁定，不能投放素材`)
      return
    }
    if (!canPlaceAssetOnTrack(asset, track.kind)) {
      setNotice(`${asset.filename} 不能放到 ${displayTrackName(track)}`)
      return
    }
    const trackKind = track.kind
    const durationFrames =
      asset.type === 'audio'
        ? Math.max(currentPreset.fps * 4, Math.round((asset.duration || 8) * currentPreset.fps))
        : Math.max(currentPreset.fps, Math.round((asset.duration || 2.4) * currentPreset.fps))
    const item: TimelineItem = {
      id: crypto.randomUUID(),
      trackId: resolvedTrackId,
      assetId: asset.id,
      type: trackKind,
      label: asset.title || asset.filename,
      startFrame,
      durationFrames,
      sourceInFrame: 0,
      effects: trackKind === 'visual' ? [DEFAULT_EFFECTS[1]] : [],
      volume: trackKind === 'music' ? 0.35 : 1,
      loop: false,
      transform:
        trackKind === 'visual'
          ? { ...defaultTransformForAsset(project, asset, resolvedTrackId, currentPreset), ...(isBackgroundAsset(asset) ? {} : transformOverride) }
          : undefined,
      keying: trackKind === 'visual' && isGreenScreenAsset(asset) ? { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 } : undefined
    }
    updateProject({
      ...project,
      assets: mergeAssets(project.assets, [asset]),
      timeline: [...project.timeline, item]
    })
    setSelectedItemId(item.id)
    setPlayheadFrame(startFrame)
    if (trackKind === 'visual' && isGreenScreenAsset(asset)) {
      void detectFirstVisibleFrame(asset, currentPreset.fps, item.keying).then((sourceInFrame) => {
        if (sourceInFrame <= 0) return
        setProject((current) => {
          if (!current || !current.timeline.some((timelineItem) => timelineItem.id === item.id)) return current
          return {
            ...current,
            updatedAt: new Date().toISOString(),
            timeline: current.timeline.map((timelineItem) =>
              timelineItem.id === item.id ? { ...timelineItem, sourceInFrame } : timelineItem
            )
          }
        })
      })
    }
  }

  function addAssetToPreview(assetId: string, clientX: number, clientY: number, stage: HTMLElement): void {
    if (!project || !currentPreset) return
    const asset = project.assets.find((item) => item.id === assetId) || localAssets.find((item) => item.id === assetId)
    if (!asset) return
    if (!isVisualAsset(asset)) {
      setNotice('只有图片、视频、GIF 可以直接拖到画面')
      return
    }
    const bounds = stage.getBoundingClientRect()
    const trackId = trackIdForVisualAsset(project, asset, selectedItem)
    const baseTransform = defaultTransformForAsset(project, asset, trackId, currentPreset)
    const transform = isBackgroundAsset(asset)
      ? defaultTransformForAsset(project, asset, backgroundTrackId(project), currentPreset)
      : {
      ...baseTransform,
      x: Math.round(((clientX - bounds.left) / bounds.width - 0.5) * currentPreset.width),
      y: Math.round(((clientY - bounds.top) / bounds.height - 0.5) * currentPreset.height)
    }
    addAssetToTimelineAt(asset, trackId, playheadFrame, transform)
    setNotice(`已拖入画面：${asset.title || asset.filename}`)
  }

  function applyTemplate(template: CatMemeTemplate): void {
    if (!project || !currentPreset) return
    const visuals = project.assets.filter((asset) => ['image', 'video', 'gif'].includes(asset.type))
    if (!visuals.length) {
      setNotice('请先导入或下载至少一个猫图/猫视频素材')
      return
    }

    const lines = scriptLines(project.script)
    let cursor = 0
    const timeline: TimelineItem[] = []
    template.defaultSceneSeconds.forEach((seconds, index) => {
      const asset = visuals[index % visuals.length]
      const durationFrames = Math.max(1, Math.round(seconds * currentPreset.fps))
      timeline.push({
        id: crypto.randomUUID(),
        trackId: 'visual-main',
        assetId: asset.id,
        type: 'visual',
        label: `${template.name} ${index + 1}`,
        startFrame: cursor,
        durationFrames,
        sourceInFrame: 0,
        effects: [template.effects[index % template.effects.length] || DEFAULT_EFFECTS[0]],
        transform: { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 }
      })
      timeline.push({
        id: crypto.randomUUID(),
        trackId: 'subtitles',
        type: 'subtitle',
        label: `字幕 ${index + 1}`,
        startFrame: cursor,
        durationFrames,
        sourceInFrame: 0,
        effects: [],
        text: lines[index] || `猫猫镜头 ${index + 1}`,
        speakerName: index % 2 === 0 ? '猫猫A' : '猫猫B',
        speakerVisible: true,
        speakerPosition: 'bottom',
        style: template.subtitleStyle
      })
      cursor += durationFrames
    })

    updateProject({
      ...project,
      subtitleStyle: template.subtitleStyle,
      timeline
    })
    setSelectedItemId(timeline[0]?.id || null)
    setPlayheadFrame(0)
    setNotice(`已套用模板：${template.name}`)
  }

  function syncSubtitles(): void {
    if (!project || !currentPreset) return
    const lines = scriptLines(project.script)
    if (!lines.length) return
    const total = Math.max(project.timeline.reduce((max, item) => Math.max(max, item.startFrame + item.durationFrames), 0), currentPreset.fps * 8)
    const durationFrames = Math.max(currentPreset.fps, Math.floor(total / lines.length))
    const subtitles = lines.map<TimelineItem>((text, index) => ({
      id: crypto.randomUUID(),
      trackId: 'subtitles',
      type: 'subtitle',
      label: `字幕 ${index + 1}`,
      startFrame: index * durationFrames,
      durationFrames,
      sourceInFrame: 0,
      effects: [],
      text,
      speakerName: index % 2 === 0 ? '猫猫A' : '猫猫B',
      speakerVisible: true,
      speakerPosition: 'bottom',
      style: project.subtitleStyle
    }))
    updateProject({
      ...project,
      timeline: [...project.timeline.filter((item) => item.type !== 'subtitle'), ...subtitles]
    })
    setNotice('字幕已按脚本同步到时间轴')
  }

  function addQuickSubtitle(): void {
    if (!project || !currentPreset) return
    const text = quickSubtitleText.trim()
    if (!text) {
      setNotice('先输入一句字幕')
      return
    }
    const durationFrames = Math.max(
      currentPreset.fps,
      Math.round((quickSubtitleSeconds > 0 ? quickSubtitleSeconds : lineDurationFrames(text, currentPreset.fps) / currentPreset.fps) * currentPreset.fps)
    )
    const subtitleItem: TimelineItem = {
      id: crypto.randomUUID(),
      trackId: 'subtitles',
      type: 'subtitle',
      label: `字幕 ${project.timeline.filter((item) => item.type === 'subtitle').length + 1}`,
      startFrame: playheadFrame,
      durationFrames,
      sourceInFrame: 0,
      effects: [],
      text,
      speakerVisible: false,
      speakerPosition: 'bottom',
      style: project.subtitleStyle
    }
    const tracks = project.tracks.some((track) => track.id === 'subtitles')
      ? project.tracks
      : [...project.tracks, { id: 'subtitles', name: '大字幕', kind: 'subtitle' as const, locked: false, muted: false }]
    updateProject({
      ...project,
      tracks,
      timeline: [...project.timeline, subtitleItem]
    })
    setSelectedItemId(subtitleItem.id)
    setQuickSubtitleText('')
    setNotice('已添加字幕')
  }

  async function generateAiScript(): Promise<void> {
    if (!project || !templates.length) return
    try {
      setBusy('生成脚本')
      const activeTemplate = templates[0]
      const response = await window.catMeme.generateScript({
        topic: aiTopic,
        templatePrompt: activeTemplate.prompt,
        seconds: 14
      })
      updateProject({
        ...project,
        title: response.title,
        script: response.subtitles.length ? response.subtitles.join('\n') : response.script,
        aiRecords: [
          ...project.aiRecords,
          {
            id: crypto.randomUUID(),
            kind: 'script',
            prompt: aiTopic,
            outputText: response.script,
            createdAt: new Date().toISOString()
          }
        ]
      })
      setNotice('AI 脚本已生成')
      setRightTab('script')
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  async function generateVoice(): Promise<void> {
    if (!project || !currentPreset) return
    try {
      setBusy('生成配音')
      const asset = await window.catMeme.tts({ text: project.script })
      addAssetsToProject([asset])
      setLocalAssets((assets) => [asset, ...assets])
      const durationFrames = Math.max(currentPreset.fps * 4, Math.max(...project.timeline.map((item) => item.startFrame + item.durationFrames), 0))
      const voiceItem: TimelineItem = {
        id: crypto.randomUUID(),
        trackId: 'voice',
        assetId: asset.id,
        type: 'voice',
        label: asset.title || 'AI 配音',
        startFrame: 0,
        durationFrames,
        sourceInFrame: 0,
        effects: [],
        volume: 1
      }
      updateProject({
        ...project,
        assets: mergeAssets(project.assets, [asset]),
        timeline: [...project.timeline.filter((item) => item.type !== 'voice'), voiceItem],
        aiRecords: [
          ...project.aiRecords,
          {
            id: crypto.randomUUID(),
            kind: 'tts',
            prompt: project.script,
            outputPath: asset.localPath,
            createdAt: new Date().toISOString()
          }
        ]
      })
      setNotice('AI 配音已加入时间轴')
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  async function saveProject(): Promise<void> {
    if (!project) return
    try {
      setBusy('保存工程')
      const result = await window.catMeme.saveProject(project)
      setProject(normalizeProject(result.project))
      setNotice(`已保存：${result.filePath}`)
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  async function loadProject(): Promise<void> {
    try {
      const result = await window.catMeme.loadProject()
      if (result?.project) {
        setProject(normalizeProject(result.project))
        setSelectedItemId(null)
        setPreview(null)
        setNotice(`已打开：${result.filePath}`)
      }
    } catch (error) {
      setNotice(errorText(error))
    }
  }

  async function newProject(): Promise<void> {
    try {
      const nextProject = await window.catMeme.newProject()
      setProject(normalizeProject(nextProject))
      setSelectedItemId(null)
      setPreview(null)
      setNotice('已创建空工程')
    } catch (error) {
      setNotice(errorText(error))
    }
  }

  async function render(mode: 'preview' | 'export', outputPath?: string): Promise<void> {
    if (!project || !currentPreset) return
    try {
      setBusy(mode === 'preview' ? '生成预览' : '导出视频')
      const request = {
        project,
        preset: currentPreset,
        mode,
        outputPath,
        outputDir: mode === 'export' ? settings?.defaultExportDir || workspace?.outputDir : undefined
      }
      const result = mode === 'preview' ? await window.catMeme.renderPreview(request) : await window.catMeme.renderExport(request)
      if (mode === 'preview') setPreview(result)
      if (mode === 'export') setLastExport(result)
      setNotice(`${mode === 'preview' ? '预览' : '视频'}已生成：${result.outputPath}`)
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  async function exportAs(): Promise<void> {
    if (!project) return
    const baseDir = settings?.defaultExportDir || workspace?.outputDir || ''
    const defaultPath = `${baseDir}\\${sanitizeFilename(project.title || 'cat-meme')}.mp4`
    const outputPath = await window.catMeme.selectExportPath(defaultPath)
    if (!outputPath) return
    await render('export', outputPath)
  }

  async function chooseExportDir(): Promise<void> {
    if (!settings) return
    const nextDir = await window.catMeme.selectExportDir(settings.defaultExportDir || workspace?.outputDir)
    if (!nextDir) return
    await persistSettings({ ...settings, defaultExportDir: nextDir })
  }

  async function persistSettings(nextSettings: AppSettings): Promise<void> {
    try {
      setSettings(nextSettings)
      const saved = await window.catMeme.saveSettings(nextSettings)
      setSettings(saved)
      setNotice('设置已保存')
    } catch (error) {
      setNotice(errorText(error))
    }
  }

  function createRole(): void {
    if (!project) return
    const roles = projectRoles(project)
    const id = crypto.randomUUID()
    const roleIndex = roles.length
    const track: TimelineTrack = {
      id: `visual-role-${id.slice(0, 8)}`,
      name: `角色 ${roleIndex + 1}`,
      kind: 'visual',
      groupId: 'role',
      locked: false,
      muted: false
    }
    const role: CharacterRole = {
      id,
      name: `角色${roleIndex + 1}`,
      title: roleIndex === 0 ? '渡劫期' : '练气期',
      color: ROLE_COLORS[roleIndex % ROLE_COLORS.length],
      defaultTrackId: track.id,
      defaultTransform: roleDefaultTransform(roleIndex),
      memeAssetIds: [],
      memeStates: createDefaultMemeStates(),
      memeKeywords: STARTER_ROLE_KEYWORDS,
      commonLines: STARTER_ROLE_LINES,
      speakerPosition: 'bottom',
      subtitlePosition: 'top'
    }
    updateProject({
      ...project,
      tracks: insertVisualTrack(project.tracks, track),
      roles: [...roles, role]
    })
    setNotice(`已创建角色：${role.name}`)
  }

  function updateRole(roleId: string, patch: Partial<CharacterRole>): void {
    if (!project) return
    updateProject({
      ...project,
      roles: projectRoles(project).map((role) => (role.id === roleId ? { ...role, ...patch } : role))
    })
  }

  function deleteRole(roleId: string): void {
    if (!project) return
    const role = projectRoles(project).find((item) => item.id === roleId)
    updateProject({
      ...project,
      roles: projectRoles(project).filter((item) => item.id !== roleId)
    })
    setNotice(role ? `已删除角色配置：${role.name}` : '已删除角色配置')
  }

  function addRoleMeme(roleId: string, asset: Asset): void {
    if (!project) return
    updateProject({
      ...project,
      assets: mergeAssets(project.assets, [asset]),
      roles: projectRoles(project).map((role) =>
        role.id === roleId ? { ...role, memeAssetIds: uniqueStrings([asset.id, ...role.memeAssetIds]) } : role
      )
    })
    setNotice(`已加入常用 meme：${asset.title || asset.filename}`)
  }

  function removeRoleMeme(roleId: string, assetId: string): void {
    if (!project) return
    updateProject({
      ...project,
      roles: projectRoles(project).map((role) =>
        role.id === roleId ? { ...role, memeAssetIds: role.memeAssetIds.filter((id) => id !== assetId) } : role
      )
    })
  }

  function createRoleMemeState(roleId: string): void {
    if (!project) return
    const nextState: CharacterMemeState = {
      id: crypto.randomUUID(),
      name: '新状态',
      keywords: ['绿幕']
    }
    updateProject({
      ...project,
      roles: projectRoles(project).map((role) =>
        role.id === roleId ? { ...role, memeStates: [...roleMemeStates(role), nextState] } : role
      )
    })
  }

  function updateRoleMemeState(roleId: string, stateId: string, patch: Partial<CharacterMemeState>): void {
    if (!project) return
    updateProject({
      ...project,
      roles: projectRoles(project).map((role) =>
        role.id === roleId
          ? {
              ...role,
              memeStates: roleMemeStates(role).map((state) => (state.id === stateId ? { ...state, ...patch } : state))
            }
          : role
      )
    })
  }

  function deleteRoleMemeState(roleId: string, stateId: string): void {
    if (!project) return
    updateProject({
      ...project,
      roles: projectRoles(project).map((role) =>
        role.id === roleId ? { ...role, memeStates: roleMemeStates(role).filter((state) => state.id !== stateId) } : role
      )
    })
  }

  function placeRoleMeme(role: CharacterRole, asset: Asset): void {
    placeRoleScene(role, asset, '')
  }

  function placeRoleLine(role: CharacterRole, line: string): void {
    if (!project || !currentPreset) return
    const durationFrames = lineDurationFrames(line, currentPreset.fps)
    const subtitleItem = createRoleSubtitleItem(role, line, playheadFrame, durationFrames)
    updateProject({
      ...project,
      timeline: [...project.timeline, subtitleItem]
    })
    setSelectedItemId(subtitleItem.id)
    setNotice(`已投放 ${role.name} 台词`)
  }

  function placeRoleScene(role: CharacterRole, asset: Asset, line: string): void {
    if (!project || !currentPreset) return
    const existingTrack = role.defaultTrackId ? project.tracks.find((track) => track.id === role.defaultTrackId) : null
    const track = existingTrack || makeRoleTrack(role)
    const tracks = existingTrack ? project.tracks : insertVisualTrack(project.tracks, track)
    const durationFrames = Math.max(
      currentPreset.fps,
      Math.round((asset.duration || 3.2) * currentPreset.fps),
      line ? lineDurationFrames(line, currentPreset.fps) : 0
    )
    const visualItem: TimelineItem = {
      id: crypto.randomUUID(),
      trackId: track.id,
      assetId: asset.id,
      roleId: role.id,
      type: 'visual',
      label: `${role.name} · ${asset.title || asset.filename}`,
      startFrame: playheadFrame,
      durationFrames,
      sourceInFrame: 0,
      effects: [DEFAULT_EFFECTS[1]],
      volume: 1,
      transform: role.defaultTransform,
      keying: isGreenScreenAsset(asset) ? { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 } : undefined
    }
    const subtitleItem = line ? createRoleSubtitleItem(role, line, playheadFrame, durationFrames) : null
    updateProject({
      ...project,
      tracks,
      assets: mergeAssets(project.assets, [asset]),
      roles: projectRoles(project).map((item) =>
        item.id === role.id ? { ...item, defaultTrackId: track.id, memeAssetIds: uniqueStrings([asset.id, ...item.memeAssetIds]) } : item
      ),
      timeline: subtitleItem ? [...project.timeline, visualItem, subtitleItem] : [...project.timeline, visualItem]
    })
    setSelectedItemId(visualItem.id)
    setPlayheadFrame(playheadFrame)
    setNotice(line ? `已投放 ${role.name} 镜头和台词` : `已投放 ${role.name} 镜头`)
  }

  function updateSelectedItem(patch: Partial<TimelineItem>): void {
    if (!project || !selectedItem) return
    updateProject({
      ...project,
      timeline: project.timeline.map((item) => (item.id === selectedItem.id ? { ...item, ...patch } : item))
    })
  }

  function moveTimelineItem(itemId: string, patch: Partial<TimelineItem>): void {
    if (!project) return
    updateProject({
      ...project,
      timeline: project.timeline.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    })
  }

  function patchTrack(trackId: string, patch: Partial<TimelineTrack>): void {
    if (!project) return
    updateProject({
      ...project,
      tracks: project.tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track))
    })
  }

  function patchTrackGroup(groupId: TrackGroupId, patch: Partial<TimelineTrack>): void {
    if (!project) return
    updateProject({
      ...project,
      tracks: normalizeProjectTracks(project.tracks.map((track) => (trackGroupId(track) === groupId ? { ...track, ...patch } : track)))
    })
  }

  function addTrackForGroup(groupId: TrackGroupId = 'role', requestedKind?: TrackKind): void {
    if (!project) return
    const kind = trackKindForGroup(groupId, requestedKind)
    const count = project.tracks.filter((track) => trackGroupId(track) === groupId && track.kind === kind).length
    const track = {
      id: `${groupId}-${kind}-${crypto.randomUUID().slice(0, 8)}`,
      name: `${newTrackBaseName(groupId, kind)} ${count + 1}`,
      kind,
      groupId,
      locked: false,
      muted: false
    }
    updateProject({ ...project, tracks: insertTrackInGroup(project.tracks, track) })
    setNotice(`已新增 ${track.name}`)
  }

  function reorderTrack(sourceTrackId: string, targetTrackId: string, placement: 'before' | 'after'): void {
    if (!project || sourceTrackId === targetTrackId) return
    const sourceTrack = project.tracks.find((track) => track.id === sourceTrackId)
    const targetTrack = project.tracks.find((track) => track.id === targetTrackId)
    if (!sourceTrack || !targetTrack) return

    const targetGroup = trackGroupId(targetTrack)
    const nextSourceTrack = canMoveTrackToGroup(sourceTrack, targetGroup)
      ? { ...sourceTrack, groupId: targetGroup }
      : sourceTrack
    if (trackGroupId(nextSourceTrack) !== targetGroup) {
      setNotice('只能在同类轨道组内调整层级')
      return
    }

    const remainingTracks = project.tracks.filter((track) => track.id !== sourceTrackId)
    const targetIndex = remainingTracks.findIndex((track) => track.id === targetTrackId)
    if (targetIndex < 0) return
    const insertIndex = placement === 'before' ? targetIndex : targetIndex + 1
    const tracks = [
      ...remainingTracks.slice(0, insertIndex),
      nextSourceTrack,
      ...remainingTracks.slice(insertIndex)
    ]
    updateProject({ ...project, tracks: normalizeProjectTracks(tracks) })
    setNotice('已调整轨道层级：下方视觉轨道会覆盖上方轨道')
  }

  function selectTrackGroupItems(groupId: TrackGroupId): void {
    if (!project) return
    const trackIds = new Set(project.tracks.filter((track) => trackGroupId(track) === groupId).map((track) => track.id))
    const firstItem = project.timeline
      .filter((item) => trackIds.has(item.trackId))
      .sort((a, b) => a.startFrame - b.startFrame)[0]
    if (!firstItem) {
      setNotice(`${trackGroupLabel(groupId)}组暂无素材`)
      return
    }
    setSelectedItemId(firstItem.id)
    setPlayheadFrame(firstItem.startFrame)
    setNotice(`已定位到${trackGroupLabel(groupId)}组的第一个素材`)
  }

  function deleteTrack(trackId: string): void {
    if (!project) return
    const track = project.tracks.find((item) => item.id === trackId)
    if (!track) return
    const sameKindCount = project.tracks.filter((item) => item.kind === track.kind).length
    if (track.kind === 'visual' && sameKindCount <= 1) {
      setNotice('至少保留一条视频轨')
      return
    }
    updateProject({
      ...project,
      tracks: project.tracks.filter((item) => item.id !== trackId),
      timeline: project.timeline.filter((item) => item.trackId !== trackId)
    })
    if (selectedItem?.trackId === trackId) setSelectedItemId(null)
    setNotice(`已删除 ${displayTrackName(track)}`)
  }

  function jumpFrames(delta: number): void {
    setPlayheadFrame((frame) => Math.max(0, Math.min(totalFrames, frame + delta)))
  }

  function jumpToEdit(direction: -1 | 1): void {
    if (!project) return
    const cuts = uniqueNumbers(project.timeline.flatMap((item) => [item.startFrame, item.startFrame + item.durationFrames])).sort((a, b) => a - b)
    const next =
      direction > 0
        ? cuts.find((frame) => frame > playheadFrame)
        : [...cuts].reverse().find((frame) => frame < playheadFrame)
    if (typeof next === 'number') setPlayheadFrame(next)
  }

  function splitSelectedItem(): void {
    if (!project || !selectedItem) return
    if (!splitTimelineItemAtFrame(selectedItem, playheadFrame)) {
      setNotice('播放头需要位于选中片段内部')
    }
  }

  function cutSelectedOrActiveItemAtPlayhead(): void {
    if (!project) return
    const target =
      selectedItem && playheadFrame > selectedItem.startFrame && playheadFrame < selectedItem.startFrame + selectedItem.durationFrames
        ? selectedItem
        : project.timeline.find((item) => playheadFrame > item.startFrame && playheadFrame < item.startFrame + item.durationFrames)
    if (!target || !splitTimelineItemAtFrame(target, playheadFrame)) {
      setNotice('播放头需要位于片段内部')
    }
  }

  function cutItemAtFrame(itemId: string, frame: number): void {
    if (!project) return
    const item = project.timeline.find((entry) => entry.id === itemId)
    if (!item || !splitTimelineItemAtFrame(item, frame)) {
      setNotice('切割位置需要位于片段内部')
    }
  }

  function splitTimelineItemAtFrame(item: TimelineItem, frame: number): boolean {
    if (!project) return false
    const localFrame = frame - item.startFrame
    if (localFrame <= 0 || localFrame >= item.durationFrames) return false
    const keyframeParts = splitVisualKeyframesAtFrame(item, localFrame)
    const first: TimelineItem = { ...item, durationFrames: localFrame, keyframes: keyframeParts.first }
    const second: TimelineItem = {
      ...item,
      id: crypto.randomUUID(),
      startFrame: frame,
      sourceInFrame: item.sourceInFrame + localFrame,
      durationFrames: item.durationFrames - localFrame,
      label: `${item.label} B`,
      keyframes: keyframeParts.second
    }
    updateProject({
      ...project,
      timeline: project.timeline.flatMap((entry) => (entry.id === item.id ? [first, second] : [entry]))
    })
    setSelectedItemId(second.id)
    setSelectedTrackId(second.trackId)
    setPlayheadFrame(frame)
    return true
  }

  function trimSelectedStartToPlayhead(): void {
    if (!selectedItem) return
    const delta = playheadFrame - selectedItem.startFrame
    if (delta <= 0 || delta >= selectedItem.durationFrames) return
    updateSelectedItem({
      startFrame: playheadFrame,
      durationFrames: selectedItem.durationFrames - delta,
      sourceInFrame: selectedItem.sourceInFrame + delta
    })
  }

  function trimSelectedEndToPlayhead(): void {
    if (!selectedItem) return
    const durationFrames = playheadFrame - selectedItem.startFrame
    if (durationFrames <= 0 || durationFrames >= selectedItem.durationFrames) return
    updateSelectedItem({ durationFrames })
  }

  function duplicateSelectedItem(): void {
    if (!project || !selectedItem) return
    const duplicate: TimelineItem = {
      ...selectedItem,
      id: crypto.randomUUID(),
      startFrame: Math.min(totalFrames, selectedItem.startFrame + selectedItem.durationFrames),
      label: `${selectedItem.label} 副本`
    }
    updateProject({
      ...project,
      timeline: [...project.timeline, duplicate]
    })
    setSelectedItemId(duplicate.id)
    setPlayheadFrame(duplicate.startFrame)
    setNotice('已复制选中片段')
  }

  function copySelectedItem(): void {
    if (!selectedItem) return
    setClipClipboard(selectedItem)
    setNotice('已复制片段，移动播放头后按 Ctrl+V 粘贴')
  }

  function pasteClipboardItem(): void {
    if (!project || !clipClipboard) return
    const trackExists = project.tracks.some((track) => track.id === clipClipboard.trackId)
    if (!trackExists) {
      setNotice('原轨道不存在，无法粘贴这个片段')
      return
    }
    const pasteStart = clampNumber(playheadFrame, 0, Math.max(0, totalFrames - 1))
    const pasted: TimelineItem = {
      ...clipClipboard,
      id: crypto.randomUUID(),
      startFrame: pasteStart,
      label: `${clipClipboard.label} 副本`
    }
    updateProject({
      ...project,
      timeline: [...project.timeline, pasted]
    })
    setSelectedItemId(pasted.id)
    setNotice('已粘贴片段')
  }

  function nudgeSelectedItem(deltaFrames: number): void {
    if (!selectedItem) return
    const startFrame = clampNumber(selectedItem.startFrame + deltaFrames, 0, Math.max(0, totalFrames - 1))
    updateSelectedItem({ startFrame })
    setPlayheadFrame(startFrame)
  }

  function patchSelectedVisualTransform(getPatch: (transform: ReturnType<typeof normalizeTransform>) => Partial<ReturnType<typeof normalizeTransform>>): void {
    if (!project || !selectedItem || selectedItem.type !== 'visual') return
    const frame = localFrameForItem(selectedItem, playheadFrame)
    const transform = visualTransformAtFrame(selectedItem, frame)
    updateSelectedItem(patchVisualTransformAtFrame(selectedItem, frame, getPatch(transform)))
  }

  function muteSelectedItem(): void {
    if (!selectedItem) return
    const currentVolume = selectedItem.volume ?? 1
    updateSelectedItem({ volume: currentVolume > 0 ? 0 : 1 })
  }

  function deleteSelectedItem(): void {
    if (!project || !selectedItem) return
    updateProject({
      ...project,
      timeline: project.timeline.filter((item) => item.id !== selectedItem.id)
    })
    setSelectedItemId(null)
  }

  function openItemContextMenu(itemId: string, clientX: number, clientY: number): void {
    setSelectedItemId(itemId)
    setContextMenu({ itemId, x: clientX, y: clientY })
  }

  function addContextName(item: TimelineItem): void {
    setContextInput({
      itemId: item.id,
      kind: 'name',
      x: contextMenu?.x || window.innerWidth / 2,
      y: contextMenu?.y || window.innerHeight / 2,
      value: item.speakerName || item.label || ''
    })
  }

  function addContextSubtitle(item: TimelineItem): void {
    setContextInput({
      itemId: item.id,
      kind: 'subtitle',
      x: contextMenu?.x || window.innerWidth / 2,
      y: contextMenu?.y || window.innerHeight / 2,
      value: item.text || ''
    })
  }

  function flipContextItem(item: TimelineItem): void {
    if (item.type !== 'visual') return
    const transform = normalizeTransform(item.transform)
    moveTimelineItem(item.id, { transform: { ...transform, flipX: !transform.flipX } })
  }

  function upsertContextSubtitle(sourceItem: TimelineItem, patch: Partial<TimelineItem>): void {
    if (!project) return
    const subtitleTrack = project.tracks.find((track) => track.id === 'subtitles')
    if (subtitleTrack?.locked) {
      setNotice('字幕轨已锁定，无法添加名称或字幕')
      return
    }
    const tracks = subtitleTrack
      ? project.tracks
      : [...project.tracks, { id: 'subtitles', name: '字幕', kind: 'subtitle' as const, locked: false, muted: false }]
    const existing = project.timeline.find(
      (item) =>
        item.type === 'subtitle' &&
        item.trackId === 'subtitles' &&
        item.startFrame === sourceItem.startFrame &&
        item.durationFrames === sourceItem.durationFrames
    )
    const nextTimeline = existing
      ? project.timeline.map((item) =>
          item.id === existing.id
            ? { ...item, ...patch, label: patch.text ? `字幕 ${project.timeline.filter((entry) => entry.type === 'subtitle').length}` : item.label }
            : item
        )
      : [
          ...project.timeline,
          {
            id: crypto.randomUUID(),
            trackId: 'subtitles',
            type: 'subtitle' as const,
            label: patch.text ? '字幕' : '名称',
            startFrame: sourceItem.startFrame,
            durationFrames: sourceItem.durationFrames,
            sourceInFrame: 0,
            effects: [],
            speakerVisible: false,
            speakerPosition: 'bottom' as const,
            style: project.subtitleStyle,
            ...patch
          }
        ]
    updateProject({ ...project, tracks, timeline: nextTimeline })
    setNotice(patch.text ? '已添加字幕' : '已添加名称')
  }

  function submitContextInput(): void {
    if (!contextInput || !contextInputItem || !project) return
    const value = contextInput.value.trim()
    if (!value) return
    if (contextInput.kind === 'name') {
      upsertContextSubtitle(contextInputItem, { speakerName: value, speakerVisible: true })
    } else {
      upsertContextSubtitle(contextInputItem, { text: value, style: project.subtitleStyle })
    }
    setContextInput(null)
  }

  function updateSubtitleStyle(patch: Partial<ProjectFile['subtitleStyle']>): void {
    if (!project) return
    const subtitleStyle = normalizeSubtitleStyleConfig({ ...project.subtitleStyle, ...patch })
    updateProject({
      ...project,
      subtitleStyle,
      timeline: project.timeline.map((item) =>
        item.type === 'subtitle' ? { ...item, style: subtitleStyle } : item
      )
    })
  }

  function updateCustomPreset(patch: Partial<ExportPreset>): void {
    if (!project) return
    const customExportPreset = {
      ...normalizeCustomPreset(project.customExportPreset),
      ...patch,
      id: 'custom',
      name: '自定义分辨率',
      platform: 'custom' as const
    }
    updateProject({
      ...project,
      exportPresetId: 'custom',
      customExportPreset
    })
  }

  function selectTimelineItem(itemId: string | null): void {
    setSelectedItemId(itemId)
    const item = itemId ? project?.timeline.find((entry) => entry.id === itemId) : null
    if (item) setSelectedTrackId(item.trackId)
  }

  function selectTrack(trackId: string, clearItem = true): void {
    setSelectedTrackId(trackId)
    if (clearItem) setSelectedItemId(null)
  }

  function changeActiveTrackGroup(group: TrackGroupFilter): void {
    setActiveTrackGroup(group)
    const track = group === 'all' ? project?.tracks[0] : project?.tracks.find((item) => trackGroupId(item) === group)
    if (track) selectTrack(track.id)
  }

  function updateProject(nextProject: ProjectFile): void {
    setProject({ ...nextProject, tracks: normalizeProjectTracks(nextProject.tracks), updatedAt: new Date().toISOString() })
  }

  function addAssetsToProject(assets: Asset[]): void {
    setProject((current) => (current ? { ...current, assets: mergeAssets(current.assets, assets) } : current))
  }

  if (!project || !settings || !workspace || !currentPreset) {
    return (
      <main className="boot-screen">
        <Loader2 className="spin" />
        <span>{notice}</span>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">CAT</span>
          <div>
            <strong>Cat Meme Studio</strong>
            <small>{workspace.root}</small>
          </div>
        </div>
        <div className="project-title">
          <input value={project.title} onChange={(event) => updateProject({ ...project, title: event.target.value })} />
          <select
            value={project.exportPresetId}
            onChange={(event) =>
              updateProject({
                ...project,
                exportPresetId: event.target.value,
                customExportPreset: event.target.value === 'custom' ? normalizeCustomPreset(project.customExportPreset) : project.customExportPreset
              })
            }
            title="导出预设"
          >
            {presets.map((preset) => (
              <option value={preset.id} key={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        <div className="top-actions">
          <IconButton title="新建工程" onClick={newProject} icon={<FilePlus2 />} />
          <IconButton title="打开工程" onClick={loadProject} icon={<FolderOpen />} />
          <IconButton title="保存工程" onClick={saveProject} icon={<Save />} />
          <button className="command ghost" onClick={() => void render('preview')} disabled={Boolean(busy)}>
            <Play size={16} />
            预览
          </button>
          <button className="command primary" onClick={() => setToolDrawer('export')} disabled={Boolean(busy)}>
            <Rocket size={16} />
            导出
          </button>
          <IconButton title="设置" onClick={() => setToolDrawer('settings')} icon={<Settings />} />
        </div>
      </header>

      <section className="statusline">
        <span>{busy ? `${busy}...` : notice}</span>
        {busy && <Loader2 className="spin" size={16} />}
      </section>

      <section className="workspace-grid">
        <AssetLibraryPanel
          localAssets={localAssets}
          filteredLocalAssets={filteredLocalAssets}
          categoryCounts={assetCategoryCounts}
          query={localAssetQuery}
          onQueryChange={setLocalAssetQuery}
          primaryCategory={assetPrimaryCategory}
          onPrimaryCategoryChange={(category) => {
            setAssetPrimaryCategory(category)
            setAssetSubCategory('all')
          }}
          subCategory={assetSubCategory}
          onSubCategoryChange={setAssetSubCategory}
          typeFilter={assetTypeFilter}
          onTypeFilterChange={setAssetTypeFilter}
          sortMode={assetSortMode}
          onSortModeChange={setAssetSortMode}
          viewMode={assetViewMode}
          onViewModeChange={setAssetViewMode}
          onImport={importLocalAssets}
          onPreprocessGreen={() => preprocessFilteredGreenScreenAssets(false)}
          onPreprocessGreenForce={() => preprocessFilteredGreenScreenAssets(true)}
          preprocessProgress={preprocessProgress}
          onAdd={addAssetToTimeline}
          onAddToPurpose={addAssetToPurpose}
          onShowFile={(asset) => window.catMeme.showItem(asset.localPath)}
        />

        <section className="center-panel">
          <div className="preview-and-inspector preview-canvas-panel">
            <div className="preview-wrap">
              <PanelTitle icon={<Film />} title="预览" />
              <div className="phone-preview">
                <QuickPreview
                  project={project}
                  items={activeVisualItems}
                  audioItems={activeAudioItems}
                  subtitle={activeSubtitleItem}
                  selectedItemId={selectedItemId}
                  playheadFrame={playheadFrame}
                  fps={currentPreset.fps}
                  presetWidth={currentPreset.width}
                  presetHeight={currentPreset.height}
                  isPlaying={isPlaying}
                  playbackRate={playerSpeed}
                  onSelect={selectTimelineItem}
                  onPatchItem={moveTimelineItem}
                  onItemContextMenu={openItemContextMenu}
                  onDropAsset={addAssetToPreview}
                />
              </div>
              <div className="preview-controls">
                <IconButton title="回到开头 Home" onClick={() => setPlayheadFrame(0)} icon={<Rewind />} />
                <IconButton title="后退一帧 ←" onClick={() => jumpFrames(-1)} icon={<StepBack />} />
                <button className="command primary play-command" onClick={() => setIsPlaying((value) => !value)}>
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  {isPlaying ? '暂停' : '播放'}
                </button>
                <IconButton title="前进一帧 →" onClick={() => jumpFrames(1)} icon={<StepForward />} />
                <IconButton title="到结尾 End" onClick={() => setPlayheadFrame(totalFrames)} icon={<FastForward />} />
                <select className="speed-select" value={playerSpeed} onChange={(event) => setPlayerSpeed(Number(event.target.value))}>
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>
            </div>
          </div>
          <div className="timeline-header">
            <div className="quick-subtitle-bar">
              <div className="asset-search-row quick-subtitle-input">
                <Captions size={15} />
                <input
                  value={quickSubtitleText}
                  onChange={(event) => setQuickSubtitleText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addQuickSubtitle()
                  }}
                  placeholder="快速字幕：输入一句话，回车添加到当前播放头"
                />
              </div>
              <label className="quick-subtitle-duration">
                <span>秒</span>
                <input
                  type="number"
                  min={0.8}
                  step={0.1}
                  value={quickSubtitleSeconds}
                  onChange={(event) => setQuickSubtitleSeconds(Math.max(0.8, Number(event.target.value) || 2.8))}
                />
              </label>
              <button className="command ghost" onClick={addQuickSubtitle}>
                <Plus size={16} />
                字幕
              </button>
            </div>
            <div className="timeline-toolbar">
              <PanelTitle icon={<SlidersHorizontal />} title="时间轴" />
              <div className="frame-readout">
                <span>总时长 {formatTime(totalFrames, currentPreset.fps)}</span>
                <span>{currentPreset.fps}fps</span>
                <span>Frame {playheadFrame}</span>
                <span>{formatTime(playheadFrame, currentPreset.fps)}</span>
                <span>缩放 {Math.round(timelineZoom * 100)}%</span>
                <button className={timelineSnapEnabled ? 'mini-link active' : 'mini-link'} onClick={() => setTimelineSnapEnabled((value) => !value)} title="磁吸贴边">
                  <Magnet size={13} />
                  磁吸
                </button>
                <button className="mini-link" onClick={() => setShowShortcutHelp((value) => !value)}>
                  快捷键
                </button>
              </div>
            </div>
            {showShortcutHelp && <ShortcutStrip />}
          </div>
          <div className="scrubber-row">
            <div className="scrubber-spacer" aria-hidden="true" />
            <input
              className="scrubber"
              type="range"
              min={0}
              max={totalFrames}
              step={1}
              value={playheadFrame}
              onChange={(event) => setPlayheadFrame(Number(event.target.value))}
            />
          </div>
          <Timeline
            project={project}
            availableAssets={mergeAssets(project.assets, localAssets)}
            totalFrames={totalFrames}
            fps={currentPreset.fps}
            selectedItemId={selectedItemId}
            playheadFrame={playheadFrame}
            activeGroup={activeTrackGroup}
            soloGroup={soloTrackGroup}
            selectedTrackId={selectedTrack?.id || null}
            onSelect={selectTimelineItem}
            onSelectTrack={selectTrack}
            onSeek={setPlayheadFrame}
            onPatchItem={moveTimelineItem}
            onPatchTrack={patchTrack}
            onPatchGroup={patchTrackGroup}
            onAddTrack={(groupId, kind) => addTrackForGroup(groupId, kind)}
            onDeleteTrack={deleteTrack}
            onReorderTrack={reorderTrack}
            onActiveGroupChange={changeActiveTrackGroup}
            onSoloGroupChange={setSoloTrackGroup}
            onSelectGroupItems={selectTrackGroupItems}
            onTotalFramesChange={(frames) => setManualTotalFrames(Math.max(frames, currentPreset.fps * 10))}
            timelineZoom={timelineZoom}
            onTimelineZoom={setTimelineZoom}
            snapEnabled={timelineSnapEnabled}
            onSnapToggle={() => setTimelineSnapEnabled((value) => !value)}
            razorMode={razorMode}
            onRazorModeChange={setRazorMode}
            onCutItemAtFrame={cutItemAtFrame}
            onItemContextMenu={openItemContextMenu}
            onDropAsset={(assetId, trackId, frame) => {
              const asset = project.assets.find((item) => item.id === assetId) || localAssets.find((item) => item.id === assetId)
              if (asset) addAssetToTimelineAt(asset, trackId, frame)
            }}
          />
        </section>

        <aside className="right-panel">
          <PropertyInspector
            project={project}
            preset={currentPreset}
            totalFrames={totalFrames}
            fps={currentPreset.fps}
            selectedTrack={selectedTrack}
            selectedItem={selectedItem}
            playheadFrame={playheadFrame}
            lastExport={lastExport}
            onPatchTrack={patchTrack}
            onPatchItem={updateSelectedItem}
            onSeek={setPlayheadFrame}
            onSplit={splitSelectedItem}
            onDelete={deleteSelectedItem}
          />

        </aside>
      </section>
      {toolDrawer && (
        <ToolDrawer title={toolDrawer === 'export' ? '导出' : '设置'} icon={toolDrawer === 'export' ? <Rocket /> : <Settings />} onClose={() => setToolDrawer(null)}>
          {toolDrawer === 'export' ? (
            <ExportDrawerContent
              project={project}
              preset={currentPreset}
              settings={settings}
              workspace={workspace}
              lastExport={lastExport}
              onChangeCustomPreset={updateCustomPreset}
              onChooseExportDir={() => void chooseExportDir()}
              onPreview={() => void render('preview')}
              onExport={() => void render('export')}
              onExportAs={() => void exportAs()}
            />
          ) : (
            <SettingsPanel settings={settings} onSave={persistSettings} />
          )}
        </ToolDrawer>
      )}
      {contextMenu && contextMenuItem && (
        <div
          className="timeline-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button onClick={() => { addContextName(contextMenuItem); setContextMenu(null) }}>
            <Captions size={14} />
            添加名称
          </button>
          <button onClick={() => { addContextSubtitle(contextMenuItem); setContextMenu(null) }}>
            <Plus size={14} />
            添加字幕
          </button>
          <button
            disabled={contextMenuItem.type !== 'visual'}
            onClick={() => { flipContextItem(contextMenuItem); setContextMenu(null) }}
          >
            <ImageIcon size={14} />
            水平翻转
          </button>
        </div>
      )}
      {contextInput && contextInputItem && (
        <form
          className="timeline-context-input"
          style={{ left: contextInput.x, top: contextInput.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault()
            submitContextInput()
          }}
        >
          <strong>{contextInput.kind === 'name' ? '添加名称' : '添加字幕'}</strong>
          <input
            ref={contextInputRef}
            value={contextInput.value}
            placeholder={contextInput.kind === 'name' ? '输入角色名称' : '输入字幕内容'}
            onChange={(event) => setContextInput((current) => (current ? { ...current, value: event.target.value } : current))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setContextInput(null)
            }}
          />
          <div className="context-input-actions">
            <button type="button" onClick={() => setContextInput(null)}>
              取消
            </button>
            <button type="submit" className="primary">
              确定
            </button>
          </div>
        </form>
      )}
    </main>
  )
}

function AssetLibraryPanel({
  localAssets,
  filteredLocalAssets,
  categoryCounts,
  query,
  onQueryChange,
  primaryCategory,
  onPrimaryCategoryChange,
  subCategory,
  onSubCategoryChange,
  typeFilter,
  onTypeFilterChange,
  sortMode,
  onSortModeChange,
  viewMode,
  onViewModeChange,
  onImport,
  onPreprocessGreen,
  onPreprocessGreenForce,
  preprocessProgress,
  onAdd,
  onAddToPurpose,
  onShowFile
}: {
  localAssets: Asset[]
  filteredLocalAssets: Asset[]
  categoryCounts: Record<AssetPrimaryCategory, number>
  query: string
  onQueryChange: (value: string) => void
  primaryCategory: AssetPrimaryCategory
  onPrimaryCategoryChange: (category: AssetPrimaryCategory) => void
  subCategory: string
  onSubCategoryChange: (category: string) => void
  typeFilter: AssetSearchRequest['type']
  onTypeFilterChange: (type: AssetSearchRequest['type']) => void
  sortMode: AssetSortMode
  onSortModeChange: (sort: AssetSortMode) => void
  viewMode: AssetViewMode
  onViewModeChange: (mode: AssetViewMode) => void
  onImport: () => Promise<void>
  onPreprocessGreen: () => Promise<void>
  onPreprocessGreenForce: () => Promise<void>
  preprocessProgress: GreenScreenPreprocessProgress | null
  onAdd: (asset: Asset, trackKind?: TrackKind) => void
  onAddToPurpose: (asset: Asset, purpose: 'background' | 'role' | 'audio') => void
  onShowFile: (asset: Asset) => Promise<void>
}): JSX.Element {
  const subcategories = ASSET_SUBCATEGORIES[primaryCategory] || ASSET_SUBCATEGORIES.all
  const greenAssets = filteredLocalAssets.filter(isGreenScreenAsset)
  const cachedGreenAssets = greenAssets.filter((asset) => Boolean(greenAlphaVariant(asset))).length
  const preprocessing = Boolean(preprocessProgress && preprocessProgress.current < preprocessProgress.total)

  return (
    <aside className="left-panel asset-workbench">
      <div className="asset-library-head">
        <PanelTitle icon={<Library />} title="素材库" />
        <span className="asset-library-mode">本地/内置素材</span>
      </div>

      <div className="asset-count-strip">
        <span>背景 {categoryCounts.background || 0}</span>
        <span>绿幕 {categoryCounts['green-screen'] || 0}</span>
        <span>音频 {categoryCounts.audio || 0}</span>
      </div>

      <div className="asset-toolbar">
        <div className="asset-search-row">
          <Search size={15} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索：哭猫 有声 绿幕 背景" />
        </div>
        <div className="asset-filter-row">
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as AssetSearchRequest['type'])}>
            {ASSET_TYPE_OPTIONS.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value as AssetSortMode)}>
            {ASSET_SORT_OPTIONS.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="asset-tool-row">
          <div className="segmented compact">
            <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => onViewModeChange('grid')}>
              网格
            </button>
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => onViewModeChange('list')}>
              列表
            </button>
          </div>
          <button className="command compact" onClick={onImport}>
            <Upload size={15} />
            导入
          </button>
          <button className="command compact" disabled={!greenAssets.length || preprocessing} onClick={onPreprocessGreen}>
            <Sparkles size={15} />
            透明缓存
          </button>
        </div>
        {greenAssets.length > 0 && (
          <div className="asset-preprocess-row">
            <span>绿幕缓存 {cachedGreenAssets}/{greenAssets.length}</span>
            <button className="mini-link" disabled={preprocessing} onClick={onPreprocessGreenForce}>
              重新生成
            </button>
            {preprocessProgress && <small>{preprocessProgress.current}/{preprocessProgress.total}</small>}
          </div>
        )}
      </div>

      <div className="asset-browser">
        <div className="asset-category-sidebar">
          {ASSET_PRIMARY_CATEGORIES.map((category) => (
            <button
              key={category.id}
              className={primaryCategory === category.id ? 'asset-category active' : 'asset-category'}
              onClick={() => onPrimaryCategoryChange(category.id)}
            >
              <strong>{category.label}</strong>
              <span>{categoryCounts[category.id] || 0}</span>
            </button>
          ))}
        </div>
        <div className="asset-browser-main">
          <div className="asset-subcategory-row">
            {subcategories.map((category) => (
              <button
                key={category.id}
                className={subCategory === category.id ? 'pill active' : 'pill'}
                onClick={() => onSubCategoryChange(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
          <div className="asset-result-summary">
            <strong>{filteredLocalAssets.length}</strong>
            <span>/ {localAssets.length} 个素材</span>
            <small>拖到预览画面或时间轴轨道即可使用</small>
          </div>
          <AssetGrid
            assets={filteredLocalAssets}
            viewMode={viewMode}
            onAdd={onAdd}
            onAddToPurpose={onAddToPurpose}
            onShowFile={onShowFile}
          />
        </div>
      </div>
    </aside>
  )
}

function AssetGrid({
  assets,
  viewMode,
  onAdd,
  onAddToPurpose,
  onShowFile
}: {
  assets: Asset[]
  viewMode: AssetViewMode
  onAdd: (asset: Asset, trackKind?: TrackKind) => void
  onAddToPurpose: (asset: Asset, purpose: 'background' | 'role' | 'audio') => void
  onShowFile: (asset: Asset) => Promise<void>
}): JSX.Element {
  const [page, setPage] = useState(0)
  const pageSize = viewMode === 'grid' ? ASSET_GRID_PAGE_SIZE : ASSET_LIST_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(assets.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const startIndex = safePage * pageSize
  const visibleAssets = assets.slice(startIndex, startIndex + pageSize)

  useEffect(() => {
    setPage(0)
  }, [assets, viewMode])

  return (
    <>
      <div className={`asset-grid ${viewMode}`}>
        {visibleAssets.map((asset) => (
          <LocalAssetCard
            key={asset.id}
            asset={asset}
            viewMode={viewMode}
            onAdd={onAdd}
            onAddToPurpose={onAddToPurpose}
            onShowFile={onShowFile}
          />
        ))}
        {!assets.length && <p className="empty-state">没有匹配素材，换个关键词或分类试试。</p>}
      </div>
      {assets.length > pageSize && (
        <div className="asset-pager">
          <button className="icon-button" title="上一页" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
            <StepBack />
          </button>
          <span>
            第 {safePage + 1} / {pageCount} 页 · {startIndex + 1}-{Math.min(startIndex + pageSize, assets.length)} / {assets.length}
          </span>
          <button className="icon-button" title="下一页" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}>
            <StepForward />
          </button>
        </div>
      )}
    </>
  )
}

function ShortcutStrip(): JSX.Element {
  return (
    <div className="shortcut-strip">
      <span>Space 播放</span>
      <span>J/K/L 后退/暂停/播放</span>
      <span>←/→ 单帧</span>
      <span>Ctrl+←/→ 跳切点</span>
      <span>Shift+←/→ 跳 15 帧</span>
      <span>B/Ctrl+K 拆分</span>
      <span>[ / ] 裁剪到播放头</span>
      <span>Ctrl+C/V 复制粘贴</span>
      <span>Alt+←/→ 微移</span>
      <span>Ctrl+滚轮 缩放</span>
      <span>H/V 对称</span>
      <span>R 旋转</span>
      <span>M 静音</span>
      <span>Delete 删除</span>
    </div>
  )
}

function LocalAssetCard({
  asset,
  viewMode,
  onAdd,
  onAddToPurpose,
  onShowFile
}: {
  asset: Asset
  viewMode: AssetViewMode
  onAdd: (asset: Asset, trackKind?: TrackKind) => void
  onAddToPurpose: (asset: Asset, purpose: 'background' | 'role' | 'audio') => void
  onShowFile: (asset: Asset) => Promise<void>
}): JSX.Element {
  const isAudio = asset.type === 'audio'
  const canUseAsAudio = isAudio || hasNativeAudioHint(asset)
  const badges = assetBadges(asset)
  const [previewActive, setPreviewActive] = useState(false)
  return (
    <article
      className={`asset-card ${viewMode} risk-${asset.riskLevel}`}
      draggable
      tabIndex={0}
      onMouseEnter={() => setPreviewActive(true)}
      onMouseLeave={() => setPreviewActive(false)}
      onFocus={() => setPreviewActive(true)}
      onBlur={() => setPreviewActive(false)}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-cat-meme-asset', asset.id)
        event.dataTransfer.setData('text/plain', asset.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        onAdd(asset, isAudio ? 'music' : 'visual')
      }}
      onDoubleClick={() => onAdd(asset, isAudio ? 'music' : 'visual')}
      title="拖到预览画面或时间轴；右键加入当前帧"
    >
      <div className="asset-thumb-wrap">
        <MemoAssetThumbnail asset={asset} active={previewActive} />
      </div>
      <div className="asset-meta">
        <strong>{asset.title || asset.filename}</strong>
        <small>
          {providerName(asset.provider)} · {formatAssetInfo(asset)}
        </small>
        <div className="asset-tags badges">
          {badges.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        {viewMode === 'list' && <span>{asset.license}</span>}
      </div>
      <div className="asset-actions">
        <IconButton title={isAudio ? '加入 BGM' : '加入画面'} onClick={() => onAdd(asset, isAudio ? 'music' : 'visual')} icon={isAudio ? <Music2 /> : <ImageIcon />} />
        {!isAudio && (
          <>
            <button className="asset-quick" onClick={() => onAddToPurpose(asset, 'background')}>
              背景
            </button>
            <button className="asset-quick" onClick={() => onAddToPurpose(asset, 'role')}>
              角色
            </button>
          </>
        )}
        <button className="asset-quick" disabled={!canUseAsAudio} onClick={() => onAddToPurpose(asset, 'audio')}>
          音频
        </button>
        <IconButton title="查看文件位置" onClick={() => void onShowFile(asset)} icon={<FolderOpen />} />
      </div>
    </article>
  )
}

function RolePanel({
  project,
  localAssets,
  playheadFrame,
  fps,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onAddMeme,
  onRemoveMeme,
  onCreateMemeState,
  onUpdateMemeState,
  onDeleteMemeState,
  onPlaceMeme,
  onPlaceLine,
  onPlaceScene
}: {
  project: ProjectFile
  localAssets: Asset[]
  playheadFrame: number
  fps: number
  onCreateRole: () => void
  onUpdateRole: (roleId: string, patch: Partial<CharacterRole>) => void
  onDeleteRole: (roleId: string) => void
  onAddMeme: (roleId: string, asset: Asset) => void
  onRemoveMeme: (roleId: string, assetId: string) => void
  onCreateMemeState: (roleId: string) => void
  onUpdateMemeState: (roleId: string, stateId: string, patch: Partial<CharacterMemeState>) => void
  onDeleteMemeState: (roleId: string, stateId: string) => void
  onPlaceMeme: (role: CharacterRole, asset: Asset) => void
  onPlaceLine: (role: CharacterRole, line: string) => void
  onPlaceScene: (role: CharacterRole, asset: Asset, line: string) => void
}): JSX.Element {
  const roles = projectRoles(project)
  return (
    <div className="right-content roles-content">
      <div className="role-toolbar">
        <div>
          <strong>角色工坊</strong>
          <span>播放头：{formatTime(playheadFrame, fps)}</span>
        </div>
        <button className="command ghost" onClick={onCreateRole}>
          <Plus size={16} />
          创建角色
        </button>
      </div>
      {roles.map((role, index) => (
        <RoleCard
          key={role.id}
          role={role}
          roleIndex={index}
          project={project}
          localAssets={localAssets}
          onUpdateRole={onUpdateRole}
          onDeleteRole={onDeleteRole}
          onAddMeme={onAddMeme}
          onRemoveMeme={onRemoveMeme}
          onCreateMemeState={onCreateMemeState}
          onUpdateMemeState={onUpdateMemeState}
          onDeleteMemeState={onDeleteMemeState}
          onPlaceMeme={onPlaceMeme}
          onPlaceLine={onPlaceLine}
          onPlaceScene={onPlaceScene}
        />
      ))}
    </div>
  )
}

function RoleCard({
  role,
  roleIndex,
  project,
  localAssets,
  onUpdateRole,
  onDeleteRole,
  onAddMeme,
  onRemoveMeme,
  onCreateMemeState,
  onUpdateMemeState,
  onDeleteMemeState,
  onPlaceMeme,
  onPlaceLine,
  onPlaceScene
}: {
  role: CharacterRole
  roleIndex: number
  project: ProjectFile
  localAssets: Asset[]
  onUpdateRole: (roleId: string, patch: Partial<CharacterRole>) => void
  onDeleteRole: (roleId: string) => void
  onAddMeme: (roleId: string, asset: Asset) => void
  onRemoveMeme: (roleId: string, assetId: string) => void
  onCreateMemeState: (roleId: string) => void
  onUpdateMemeState: (roleId: string, stateId: string, patch: Partial<CharacterMemeState>) => void
  onDeleteMemeState: (roleId: string, stateId: string) => void
  onPlaceMeme: (role: CharacterRole, asset: Asset) => void
  onPlaceLine: (role: CharacterRole, line: string) => void
  onPlaceScene: (role: CharacterRole, asset: Asset, line: string) => void
}): JSX.Element {
  const roleAssets = resolveRoleAssets(role, project.assets, localAssets)
  const recommendedAssets = recommendAssetsForRole(role, localAssets, project.assets).slice(0, 8)
  const stateAssets = recommendAssetsForStates(role, localAssets, project.assets)
  const defaultAsset = roleAssets[0] || recommendedAssets[0]
  const commonLines = roleLines(role)
  const defaultLine = commonLines[0] || ''

  return (
    <article className="role-card" style={{ borderTopColor: role.color }}>
      <div className="role-card-head">
        <div className="role-avatar" style={{ background: role.color }}>
          {role.name.slice(0, 2)}
        </div>
        <div>
          <strong>{role.name || `角色${roleIndex + 1}`}</strong>
          <span>{role.title || '未设置身份'}</span>
        </div>
        <button className="icon-button" title="删除角色配置" onClick={() => onDeleteRole(role.id)}>
          <Trash2 />
        </button>
      </div>

      <div className="role-fields">
        <label className="field compact">
          <span>角色名称</span>
          <input value={role.name} onChange={(event) => onUpdateRole(role.id, { name: event.target.value })} />
        </label>
        <label className="field compact">
          <span>身份标签</span>
          <input value={role.title} onChange={(event) => onUpdateRole(role.id, { title: event.target.value })} />
        </label>
        <label className="field compact">
          <span>角色色</span>
          <input type="color" value={role.color} onChange={(event) => onUpdateRole(role.id, { color: event.target.value })} />
        </label>
        <label className="field compact">
          <span>默认轨道</span>
          <select value={role.defaultTrackId || ''} onChange={(event) => onUpdateRole(role.id, { defaultTrackId: event.target.value })}>
            {project.tracks
              .filter((track) => track.kind === 'visual')
              .map((track) => (
                <option value={track.id} key={track.id}>
                  {track.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field compact">
          <span>默认站位</span>
          <select
            value={rolePositionId(role.defaultTransform)}
            onChange={(event) => onUpdateRole(role.id, { defaultTransform: roleTransformPreset(event.target.value, roleIndex) })}
          >
            <option value="left">左下</option>
            <option value="center">中下</option>
            <option value="right">右下</option>
            <option value="top">顶部表情</option>
          </select>
        </label>
        <label className="field compact">
          <span>名称位置</span>
          <select value={role.speakerPosition} onChange={(event) => onUpdateRole(role.id, { speakerPosition: event.target.value as CharacterRole['speakerPosition'] })}>
            <option value="top">上方</option>
            <option value="middle">中间</option>
            <option value="bottom">下方</option>
          </select>
        </label>
        <label className="field compact">
          <span>字幕位置</span>
          <select value={role.subtitlePosition} onChange={(event) => onUpdateRole(role.id, { subtitlePosition: event.target.value as CharacterRole['subtitlePosition'] })}>
            <option value="top">上方</option>
            <option value="middle">中间</option>
            <option value="bottom">下方</option>
          </select>
        </label>
      </div>

      <label className="field compact">
        <span>常用 meme 关键词</span>
        <input
          value={roleKeywords(role).join(' ')}
          onChange={(event) => onUpdateRole(role.id, { memeKeywords: textToTokens(event.target.value) })}
          placeholder="香蕉猫 哭泣 震惊 有声"
        />
      </label>

      <div className="role-action-row">
        <button className="command" disabled={!defaultAsset} onClick={() => defaultAsset && onPlaceMeme(role, defaultAsset)}>
          <ImageIcon size={16} />
          出场
        </button>
        <button className="command" disabled={!defaultLine} onClick={() => defaultLine && onPlaceLine(role, defaultLine)}>
          <Captions size={16} />
          台词
        </button>
        <button className="command primary" disabled={!defaultAsset || !defaultLine} onClick={() => defaultAsset && defaultLine && onPlaceScene(role, defaultAsset, defaultLine)}>
          <Sparkles size={16} />
          镜头+台词
        </button>
      </div>

      <div className="role-section-title">
        <span>状态 meme</span>
        <button className="mini-link" onClick={() => onCreateMemeState(role.id)}>新增状态</button>
      </div>
      <div className="role-state-list">
        {roleMemeStates(role).map((state) => (
          <RoleStateEditor
            key={state.id}
            role={role}
            state={state}
            assets={stateAssets}
            onUpdate={(patch) => onUpdateMemeState(role.id, state.id, patch)}
            onDelete={() => onDeleteMemeState(role.id, state.id)}
            onPlace={(asset, line) => onPlaceScene(role, asset, line)}
          />
        ))}
      </div>

      <div className="role-section-title">
        <span>常用 meme</span>
        <small>{roleAssets.length} 个</small>
      </div>
      <div className="role-meme-grid">
        {roleAssets.length ? (
          roleAssets.slice(0, 6).map((asset) => (
            <RoleMemeTile key={asset.id} asset={asset} onPlace={() => onPlaceMeme(role, asset)} onRemove={() => onRemoveMeme(role.id, asset.id)} />
          ))
        ) : (
          <p className="role-empty">从推荐素材收藏后会固定在这里。</p>
        )}
      </div>

      <div className="role-section-title">
        <span>推荐素材</span>
        <small>按关键词匹配</small>
      </div>
      <div className="role-recommend-strip">
        {recommendedAssets.map((asset) => (
          <RoleMemeTile
            key={asset.id}
            asset={asset}
            onPlace={() => onPlaceScene(role, asset, defaultLine)}
            onPin={() => onAddMeme(role.id, asset)}
          />
        ))}
      </div>

      <label className="field compact">
        <span>角色常用台词</span>
        <textarea
          value={commonLines.join('\n')}
          onChange={(event) => onUpdateRole(role.id, { commonLines: textToLines(event.target.value) })}
        />
      </label>
      <div className="role-line-list">
        {commonLines.slice(0, 4).map((line) => (
          <button key={line} onClick={() => onPlaceLine(role, line)} title="投放这句台词">
            {line}
          </button>
        ))}
      </div>
    </article>
  )
}

function RoleMemeTile({
  asset,
  onPlace,
  onPin,
  onRemove
}: {
  asset: Asset
  onPlace: () => void
  onPin?: () => void
  onRemove?: () => void
}): JSX.Element {
  return (
    <div
      className="role-meme-tile"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-cat-meme-asset', asset.id)
        event.dataTransfer.setData('text/plain', asset.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      title="可直接拖到时间轴"
    >
      <MemoMediaThumb src={asset.fileUrl} type={asset.type} />
      <strong>{asset.title || asset.filename}</strong>
      <div>
        <button onClick={onPlace}>投放</button>
        {onPin && <button onClick={onPin}>收藏</button>}
        {onRemove && <button onClick={onRemove}>移除</button>}
      </div>
    </div>
  )
}

function RoleStateEditor({
  role,
  state,
  assets,
  onUpdate,
  onDelete,
  onPlace
}: {
  role: CharacterRole
  state: CharacterMemeState
  assets: Asset[]
  onUpdate: (patch: Partial<CharacterMemeState>) => void
  onDelete: () => void
  onPlace: (asset: Asset, line: string) => void
}): JSX.Element {
  const selectedAsset = assets.find((asset) => asset.id === state.assetId) || assets[0]
  const line = state.line || roleLines(role)[0] || ''
  return (
    <div className="role-state-row">
      <label className="field compact">
        <span>状态名</span>
        <input value={state.name} onChange={(event) => onUpdate({ name: event.target.value })} />
      </label>
      <label className="field compact">
        <span>绑定 meme</span>
        <select value={state.assetId || selectedAsset?.id || ''} onChange={(event) => onUpdate({ assetId: event.target.value })}>
          {assets.map((asset) => (
            <option value={asset.id} key={asset.id}>
              {asset.title || asset.filename}
            </option>
          ))}
        </select>
      </label>
      <label className="field compact">
        <span>匹配关键词</span>
        <input value={safeStringArray(state.keywords).join(' ')} onChange={(event) => onUpdate({ keywords: textToTokens(event.target.value) })} />
      </label>
      <label className="field compact">
        <span>默认台词</span>
        <input value={state.line || ''} onChange={(event) => onUpdate({ line: event.target.value })} placeholder={roleLines(role)[0] || '可留空'} />
      </label>
      <div className="role-state-actions">
        <button className="command" disabled={!selectedAsset} onClick={() => selectedAsset && onPlace(selectedAsset, line)}>
          投放状态
        </button>
        <button className="command danger" onClick={onDelete}>
          删除
        </button>
      </div>
    </div>
  )
}

function MediaThumb({ src, type, active = false }: { src?: string; type: string; active?: boolean }): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video || type !== 'video') return
    if (active) {
      video.currentTime = Math.min(video.currentTime || 0, Number.isFinite(video.duration) ? video.duration : 0)
      void video.play().catch(() => undefined)
    } else {
      video.pause()
      if (Number.isFinite(video.duration)) video.currentTime = 0
    }
  }, [active, src, type])
  if (!src) {
    return (
      <div className="thumb empty">
        {type === 'audio' ? <Music2 size={18} /> : <ImageIcon size={18} />}
      </div>
    )
  }
  if (type === 'video') return <video ref={videoRef} className="thumb" src={src} muted loop playsInline preload={active ? 'auto' : 'metadata'} />
  if (type === 'gif') return <GifThumb src={src} active={active} />
  if (type === 'audio') {
    return (
      <div className="thumb empty">
        <Music2 size={18} />
      </div>
    )
  }
  return <img className="thumb" src={src} alt="" loading="lazy" decoding="async" />
}

function GifThumb({ src, active }: { src: string; active: boolean }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  function drawStill(): void {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image || !mediaReady(image)) return
    const context = canvas.getContext('2d')
    if (!context) return
    canvas.width = 360
    canvas.height = 220
    context.clearRect(0, 0, canvas.width, canvas.height)
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
  }

  useEffect(() => {
    const timer = window.setTimeout(drawStill, 80)
    return () => window.clearTimeout(timer)
  }, [src])

  if (active) return <img className="thumb" src={src} alt="" loading="lazy" decoding="async" />

  return (
    <div className="thumb green-thumb">
      <canvas ref={canvasRef} />
      <img ref={imageRef} className="thumb-source" src={src} alt="" loading="lazy" decoding="async" onLoad={drawStill} />
    </div>
  )
}

function AssetThumbnail({ asset, active = false }: { asset: Asset; active?: boolean }): JSX.Element {
  const alphaVariant = greenAlphaVariant(asset)
  if (alphaVariant?.fileUrl) {
    return <MediaThumb src={alphaVariant.fileUrl} type={alphaVariant.format === 'png' ? 'image' : 'video'} active={active} />
  }
  if (asset.fileUrl && asset.type !== 'audio' && isGreenScreenAsset(asset)) {
    if (!active) {
      return <MediaThumb src={asset.fileUrl} type={asset.type} />
    }
    if (asset.type === 'video') return <GreenScreenVideoThumb asset={asset} />
    return <GreenScreenAssetThumb asset={asset} />
  }
  return <MediaThumb src={asset.fileUrl} type={asset.type} active={active} />
}

function GreenScreenVideoThumb({ asset }: { asset: Asset }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const drewFrameRef = useRef(false)
  const [hasFrame, setHasFrame] = useState(false)
  const [fallback, setFallback] = useState(false)

  function draw(): void {
    const canvas = canvasRef.current
    const media = videoRef.current
    if (!canvas || !media || !mediaReady(media)) return
    canvas.width = 360
    canvas.height = 220
    drawKeyedFrame(canvas, media, { enabled: true, color: '#00ff00', similarity: 0.28, blend: 0.08 })
    drewFrameRef.current = true
    setHasFrame(true)
  }

  function seekPreviewFrame(): void {
    const media = videoRef.current
    if (!media || !mediaReady(media)) return
    const duration = Number.isFinite(media.duration) ? media.duration : 0
    const target = duration > 1 ? Math.min(1, duration * 0.12) : 0

    try {
      if (Math.abs(media.currentTime - target) < 0.04) {
        draw()
      } else {
        media.currentTime = target
      }
    } catch {
      draw()
    }
    media.loop = true
    void media.play().catch(() => undefined)
  }

  useEffect(() => {
    drewFrameRef.current = false
    setHasFrame(false)
    setFallback(false)
    const timer = window.setTimeout(() => {
      if (!drewFrameRef.current) setFallback(true)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [asset.fileUrl])

  if (fallback) return <MediaThumb src={asset.fileUrl} type={asset.type} />

  return (
    <div className="thumb green-thumb green-video-thumb">
      <canvas ref={canvasRef} className={hasFrame ? '' : 'thumb-canvas-pending'} />
      <video
        ref={videoRef}
        className={hasFrame ? 'thumb-source' : 'green-video-source'}
        src={asset.fileUrl}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={seekPreviewFrame}
        onLoadedData={seekPreviewFrame}
        onSeeked={draw}
        onError={() => setFallback(true)}
      />
    </div>
  )
}

function GreenScreenAssetThumb({ asset }: { asset: Asset }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  function draw(): void {
    const canvas = canvasRef.current
    const media = imageRef.current
    if (!canvas || !media || !mediaReady(media)) return
    canvas.width = 360
    canvas.height = 220
    drawKeyedFrame(canvas, media, { enabled: true, color: '#00ff00', similarity: 0.28, blend: 0.08 })
  }

  useEffect(() => {
    const timer = window.setTimeout(draw, 120)
    return () => window.clearTimeout(timer)
  }, [asset.fileUrl, asset.type])

  return (
    <div className="thumb green-thumb">
      <canvas ref={canvasRef} />
      <img ref={imageRef} className="thumb-source" src={asset.fileUrl} alt="" loading="lazy" decoding="async" onLoad={draw} />
    </div>
  )
}

const MemoMediaThumb = memo(MediaThumb)
const MemoAssetThumbnail = memo(AssetThumbnail)

function QuickPreview({
  project,
  items,
  audioItems,
  subtitle,
  selectedItemId,
  playheadFrame,
  fps,
  presetWidth,
  presetHeight,
  isPlaying,
  playbackRate,
  onSelect,
  onPatchItem,
  onItemContextMenu,
  onDropAsset
}: {
  project: ProjectFile
  items: TimelineItem[]
  audioItems: TimelineItem[]
  subtitle: TimelineItem | null
  selectedItemId: string | null
  playheadFrame: number
  fps: number
  presetWidth: number
  presetHeight: number
  isPlaying: boolean
  playbackRate: number
  onSelect: (id: string) => void
  onPatchItem: (id: string, patch: Partial<TimelineItem>) => void
  onItemContextMenu: (id: string, clientX: number, clientY: number) => void
  onDropAsset: (assetId: string, clientX: number, clientY: number, stage: HTMLElement) => void
}): JSX.Element {
  const subtitleText = subtitle?.text || ''
  const subtitleStyle = normalizeSubtitleStyle(project.subtitleStyle, subtitle?.style)
  const speakerPosition = subtitle?.speakerPosition || subtitleStyle.position
  const wheelTarget = items.find((item) => item.id === selectedItemId) || items[items.length - 1]
  const stageStyle = previewStageStyle(presetWidth, presetHeight)

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    const assetId = event.dataTransfer.getData('application/x-cat-meme-asset') || event.dataTransfer.getData('text/plain')
    if (assetId) onDropAsset(assetId, event.clientX, event.clientY, event.currentTarget)
  }

  return (
    <div
      className="quick-preview-stage"
      style={stageStyle}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={handleDrop}
      onWheel={(event) => {
        if (!event.ctrlKey || !wheelTarget) return
        event.preventDefault()
        const localFrame = localFrameForItem(wheelTarget, playheadFrame)
        const transform = visualTransformAtFrame(wheelTarget, localFrame)
        const factor = event.deltaY < 0 ? 1.08 : 0.92
        onPatchItem(wheelTarget.id, patchVisualTransformAtFrame(wheelTarget, localFrame, { scale: clampNumber(transform.scale * factor, 0.08, 4) }))
        onSelect(wheelTarget.id)
      }}
    >
      {!items.length && (
        <div className="preview-empty">
          <Film size={38} />
          <span>把素材拖到这里，直接放进画面</span>
        </div>
      )}
      {items.map((item) => {
        const asset = item.assetId ? project.assets.find((asset) => asset.id === item.assetId) : null
        if (!asset?.fileUrl) return null
        return (
          <QuickPreviewLayer
            key={item.id}
            item={item}
            asset={asset}
            selected={selectedItemId === item.id}
            playheadFrame={playheadFrame}
            fps={fps}
            presetWidth={presetWidth}
            presetHeight={presetHeight}
            isPlaying={isPlaying}
            onSelect={onSelect}
            onPatchItem={onPatchItem}
            onItemContextMenu={onItemContextMenu}
          />
        )
      })}
      <PreviewAudioBridge project={project} items={audioItems} playheadFrame={playheadFrame} fps={fps} isPlaying={isPlaying} playbackRate={playbackRate} />
      {subtitle?.speakerVisible && subtitle.speakerName && (
        <div className={`preview-speaker speaker-${speakerPosition}`}>{subtitle.speakerName}</div>
      )}
      {subtitleText && (
        <div className={`preview-subtitle subtitle-${subtitleStyle.position}`} style={previewSubtitleCss(subtitleStyle)}>
          {subtitleText}
        </div>
      )}
    </div>
  )
}

function QuickPreviewLayer({
  item,
  asset,
  selected,
  playheadFrame,
  fps,
  presetWidth,
  presetHeight,
  isPlaying,
  onSelect,
  onPatchItem,
  onItemContextMenu
}: {
  item: TimelineItem
  asset: Asset
  selected: boolean
  playheadFrame: number
  fps: number
  presetWidth: number
  presetHeight: number
  isPlaying: boolean
  onSelect: (id: string) => void
  onPatchItem: (id: string, patch: Partial<TimelineItem>) => void
  onItemContextMenu: (id: string, clientX: number, clientY: number) => void
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [dragState, setDragState] = useState<{
    startX: number
    startY: number
    localFrame: number
    startTransform: NormalizedTransform
    stageWidth: number
    stageHeight: number
  } | null>(null)
  const [mediaSize, setMediaSize] = useState(() => mediaCanvasSize(asset))
  const [visibleBounds, setVisibleBounds] = useState<VisibleBounds>({ left: 0, top: 0, width: 1, height: 1 })
  const alphaVariant = greenAlphaVariant(asset)
  const mediaSrc = alphaVariant?.fileUrl || asset.fileUrl
  const mediaType = alphaVariant?.format === 'png' ? 'image' : alphaVariant?.format === 'webm' ? 'video' : asset.type
  const localFrame = localFrameForItem(item, playheadFrame)
  const currentSeconds = mediaPlaybackSeconds(item, asset, localFrame, fps)
  const transform = visualTransformAtFrame(item, localFrame)
  const keying = normalizeKeying(item.keying)
  const shouldKey = keying.enabled && !alphaVariant
  const style = previewLayerStyle(item, asset, transform, presetWidth, presetHeight, mediaSize)

  useEffect(() => {
    setMediaSize(mediaCanvasSize(asset))
  }, [asset.id, asset.type, asset.width, asset.height])

  useEffect(() => {
    if (!shouldKey) setVisibleBounds({ left: 0, top: 0, width: 1, height: 1 })
  }, [shouldKey, asset.id])

  const updateVisibleBounds = useCallback((bounds: VisibleBounds) => {
    setVisibleBounds((current) => {
      const changed =
        Math.abs(current.left - bounds.left) > 0.01 ||
        Math.abs(current.top - bounds.top) > 0.01 ||
        Math.abs(current.width - bounds.width) > 0.01 ||
        Math.abs(current.height - bounds.height) > 0.01
      return changed ? bounds : current
    })
  }, [])

  useEffect(() => {
    if (!dragState) return
    const activeDrag = dragState

    function onPointerMove(event: globalThis.PointerEvent): void {
      const nextTransform = {
        ...activeDrag.startTransform,
        x: Math.round(activeDrag.startTransform.x + ((event.clientX - activeDrag.startX) / activeDrag.stageWidth) * presetWidth),
        y: Math.round(activeDrag.startTransform.y + ((event.clientY - activeDrag.startY) / activeDrag.stageHeight) * presetHeight)
      }
      onPatchItem(item.id, patchVisualTransformAtFrame(item, activeDrag.localFrame, nextTransform))
    }

    function onPointerUp(): void {
      setDragState(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, item, onPatchItem, presetHeight, presetWidth])

  function beginStageDrag(event: PointerEvent<HTMLDivElement>): void {
    event.preventDefault()
    event.stopPropagation()
    const stage = event.currentTarget.closest<HTMLElement>('.quick-preview-stage')
    const bounds = stage?.getBoundingClientRect()
    onSelect(item.id)
    setDragState({
      startX: event.clientX,
      startY: event.clientY,
      localFrame,
      startTransform: transform,
      stageWidth: bounds?.width || 540,
      stageHeight: bounds?.height || 960
    })
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || mediaType !== 'video') return
    if (!isPlaying || Math.abs(video.currentTime - currentSeconds) > 0.45) {
      video.currentTime = Math.max(0, currentSeconds)
    }
    if (isPlaying) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [currentSeconds, isPlaying, mediaType])

  let content: JSX.Element | null = null
  if (!mediaSrc) return <></>
  if (shouldKey && ['image', 'video', 'gif'].includes(asset.type)) {
    content = (
      <KeyedMediaCanvas
        asset={asset}
        item={item}
        currentSeconds={currentSeconds}
        isPlaying={isPlaying}
        onMediaSize={setMediaSize}
        onVisibleBounds={updateVisibleBounds}
      />
    )
  } else if (mediaType === 'video') {
    content = <video ref={videoRef} src={mediaSrc} muted playsInline preload="auto" onLoadedMetadata={(event) => setMediaSize(mediaElementSize(event.currentTarget))} />
  } else if (['image', 'gif'].includes(mediaType)) {
    content = <img src={mediaSrc} alt="" loading="lazy" decoding="async" onLoad={(event) => setMediaSize(mediaElementSize(event.currentTarget))} />
  }

  if (!content) return <></>

  return (
    <div className="preview-layer" style={style}>
      {content}
      <div
        className={`preview-hitbox ${selected ? 'selected' : ''}`}
        style={visibleBoundsStyle(visibleBounds)}
        onPointerDown={beginStageDrag}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onItemContextMenu(item.id, event.clientX, event.clientY)
        }}
      />
    </div>
  )
}

function PreviewAudioBridge({
  project,
  items,
  playheadFrame,
  fps,
  isPlaying,
  playbackRate
}: {
  project: ProjectFile
  items: TimelineItem[]
  playheadFrame: number
  fps: number
  isPlaying: boolean
  playbackRate: number
}): JSX.Element {
  return (
    <>
      {items.map((item) => {
        const asset = item.assetId ? project.assets.find((asset) => asset.id === item.assetId) : null
        if (!asset?.fileUrl) return null
        return <PreviewAudioElement key={item.id} item={item} asset={asset} playheadFrame={playheadFrame} fps={fps} isPlaying={isPlaying} playbackRate={playbackRate} />
      })}
    </>
  )
}

function PreviewAudioElement({
  item,
  asset,
  playheadFrame,
  fps,
  isPlaying,
  playbackRate
}: {
  item: TimelineItem
  asset: Asset
  playheadFrame: number
  fps: number
  isPlaying: boolean
  playbackRate: number
}): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentSeconds = mediaPlaybackSeconds(item, asset, playheadFrame - item.startFrame, fps)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = clampNumber(item.volume ?? (item.type === 'music' ? 0.35 : 1), 0, 1)
    audio.playbackRate = clampNumber(playbackRate, 0.25, 4)
    if (Math.abs(audio.currentTime - currentSeconds) > 0.35) {
      audio.currentTime = currentSeconds
    }
    if (isPlaying) {
      void audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [asset.fileUrl, currentSeconds, isPlaying, item.type, item.volume, playbackRate])

  return <audio ref={audioRef} src={asset.fileUrl} preload="auto" />
}

function KeyedMediaCanvas({
  asset,
  item,
  currentSeconds,
  isPlaying,
  onMediaSize,
  onVisibleBounds
}: {
  asset: Asset
  item: TimelineItem
  currentSeconds: number
  isPlaying: boolean
  onMediaSize: (size: { width: number; height: number }) => void
  onVisibleBounds: (bounds: VisibleBounds) => void
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [canvasSize, setCanvasSize] = useState(() => mediaCanvasSize(asset))
  const keying = normalizeKeying(item.keying)

  useEffect(() => {
    const video = videoRef.current
    if (!video || asset.type !== 'video') return
    if (!isPlaying || Math.abs(video.currentTime - currentSeconds) > 0.45) {
      video.currentTime = Math.max(0, currentSeconds)
    }
    if (isPlaying) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [asset.type, currentSeconds, isPlaying])

  useEffect(() => {
    let frame = 0
    let stopped = false

    function draw(): void {
      if (stopped) return
      const canvas = canvasRef.current
      const media = asset.type === 'video' ? videoRef.current : imageRef.current
      if (canvas && media && mediaReady(media)) {
        const bounds = drawKeyedFrame(canvas, media, keying)
        onVisibleBounds(bounds && isUsefulForegroundBounds(bounds) ? bounds : { left: 0, top: 0, width: 1, height: 1 })
      }
      frame = window.requestAnimationFrame(draw)
    }

    draw()
    return () => {
      stopped = true
      window.cancelAnimationFrame(frame)
    }
  }, [asset.type, keying.blend, keying.color, keying.enabled, keying.similarity, onVisibleBounds])

  return (
    <>
      {asset.type === 'video' ? (
        <video
          ref={videoRef}
          src={asset.fileUrl}
          muted
          playsInline
          className="key-source"
          onLoadedMetadata={(event) => {
            const size = mediaElementSize(event.currentTarget)
            setCanvasSize(size)
            onMediaSize(size)
          }}
        />
      ) : (
        <img
          ref={imageRef}
          src={asset.fileUrl}
          alt=""
          className="key-source"
          onLoad={(event) => {
            const size = mediaElementSize(event.currentTarget)
            setCanvasSize(size)
            onMediaSize(size)
          }}
        />
      )}
      <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="keyed-canvas" />
    </>
  )
}

function PropertyInspector({
  project,
  preset,
  totalFrames,
  fps,
  selectedTrack,
  selectedItem,
  playheadFrame,
  lastExport,
  onPatchTrack,
  onPatchItem,
  onSeek,
  onSplit,
  onDelete
}: {
  project: ProjectFile
  preset: ExportPreset
  totalFrames: number
  fps: number
  selectedTrack: TimelineTrack | null
  selectedItem: TimelineItem | null
  playheadFrame: number
  lastExport: RenderResult | null
  onPatchTrack: (trackId: string, patch: Partial<TimelineTrack>) => void
  onPatchItem: (patch: Partial<TimelineItem>) => void
  onSeek: (frame: number) => void
  onSplit: () => void
  onDelete: () => void
}): JSX.Element {
  return (
    <div className="property-inspector">
      <TrackInspector project={project} track={selectedTrack} onPatchTrack={onPatchTrack} />
      <div className="property-section">
        {selectedItem ? (
          <SelectedInspector
            item={selectedItem}
            fps={fps}
            playheadFrame={playheadFrame}
            onPatch={onPatchItem}
            onSeek={onSeek}
            onSplit={onSplit}
            onDelete={onDelete}
          />
        ) : (
          <ProjectOverviewInspector project={project} preset={preset} totalFrames={totalFrames} fps={fps} lastExport={lastExport} />
        )}
      </div>
    </div>
  )
}

function TrackInspector({
  project,
  track,
  onPatchTrack
}: {
  project: ProjectFile
  track: TimelineTrack | null
  onPatchTrack: (trackId: string, patch: Partial<TimelineTrack>) => void
}): JSX.Element {
  if (!track) {
    return (
      <section className="inspector track-inspector">
        <PanelTitle icon={<Layers />} title="轨道" />
        <p className="muted">未选中轨道</p>
      </section>
    )
  }

  const groupId = trackGroupId(track)
  const group = trackGroupDefinition(groupId)
  const itemCount = project.timeline.filter((item) => item.trackId === track.id).length
  const outputLabel = track.kind === 'visual' || track.kind === 'subtitle' ? '画面输出' : '声音输出'
  const groupOptions = TRACK_GROUPS.filter((option) => canMoveTrackToGroup(track, option.id))

  return (
    <section className="inspector track-inspector">
      <PanelTitle icon={<Layers />} title="轨道参数" />
      <label className="field compact">
        <span>轨道名称</span>
        <input value={track.name} onChange={(event) => onPatchTrack(track.id, { name: event.target.value })} />
      </label>
      <div className="two-buttons">
        <label className="field compact">
          <span>轨道组</span>
          <select value={groupId} onChange={(event) => onPatchTrack(track.id, { groupId: event.target.value as TrackGroupId })}>
            {groupOptions.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact">
          <span>类型</span>
          <input value={trackKindName(track.kind)} disabled />
        </label>
      </div>
      <div className="track-toggle-row">
        <button className={track.locked ? 'mini-link active' : 'mini-link'} onClick={() => onPatchTrack(track.id, { locked: !track.locked })}>
          {track.locked ? <Lock size={13} /> : <Unlock size={13} />}
          {track.locked ? '已锁定' : '未锁定'}
        </button>
        <button className={track.muted ? 'mini-link active' : 'mini-link'} onClick={() => onPatchTrack(track.id, { muted: !track.muted })}>
          {track.kind === 'visual' || track.kind === 'subtitle' ? (track.muted ? <EyeOff size={13} /> : <Eye size={13} />) : track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          {track.muted ? '已关闭' : '已开启'}
        </button>
      </div>
      <div className="overview-metrics compact-metrics">
        <Metric label="轨道组" value={group.label} />
        <Metric label="素材数" value={String(itemCount)} />
        <Metric label="层级" value={group.output === 'visual' ? '下方更上层' : '混音'} />
        <Metric label={outputLabel} value={track.muted ? '关闭' : '开启'} />
      </div>
      <p className="muted small-note">视觉轨道越靠下，画面里越在上层；拖动轨道左侧把手可调整层级。</p>
    </section>
  )
}

function SelectedInspector({
  item,
  fps,
  playheadFrame,
  onPatch,
  onSeek,
  onSplit,
  onDelete
}: {
  item: TimelineItem | null
  fps: number
  playheadFrame: number
  onPatch: (patch: Partial<TimelineItem>) => void
  onSeek: (frame: number) => void
  onSplit: () => void
  onDelete: () => void
}): JSX.Element {
  if (!item) {
    return (
      <section className="inspector">
        <PanelTitle icon={<SlidersHorizontal />} title="片段" />
        <p className="muted">未选中片段</p>
      </section>
    )
  }
  const effect = item.effects[0] || DEFAULT_EFFECTS[0]
  return (
    <section className="inspector">
      <PanelTitle icon={<SlidersHorizontal />} title="片段" />
      <label className="field compact">
        <span>名称</span>
        <input value={item.label} onChange={(event) => onPatch({ label: event.target.value })} />
      </label>
      <div className="number-grid">
        <NumberField label="起始帧" value={item.startFrame} onChange={(value) => onPatch({ startFrame: value })} />
        <NumberField label="时长帧" value={item.durationFrames} onChange={(value) => onPatch({ durationFrames: Math.max(1, value) })} />
        <NumberField label="入点帧" value={item.sourceInFrame} onChange={(value) => onPatch({ sourceInFrame: Math.max(0, value) })} />
        <NumberField label="音量" value={Math.round((item.volume ?? 1) * 100)} onChange={(value) => onPatch({ volume: value / 100 })} />
      </div>
      {item.type !== 'subtitle' && (
        <button className={item.loop ? 'loop-toggle active' : 'loop-toggle'} onClick={() => onPatch({ loop: !item.loop })}>
          <Repeat2 size={14} />
          {item.loop ? '循环播放已开启' : '循环播放关闭'}
        </button>
      )}
      {item.type === 'subtitle' && (
        <DialogueInspector item={item} onPatch={onPatch} />
      )}
      {item.type === 'visual' && (
        <>
          <label className="field compact">
            <span>效果</span>
            <select
              value={effect.type}
              onChange={(event) =>
                onPatch({
                  effects: [
                    DEFAULT_EFFECTS.find((item) => item.type === event.target.value) || {
                      id: crypto.randomUUID(),
                      type: 'none',
                      intensity: 0
                    }
                  ]
                })
              }
            >
              {DEFAULT_EFFECTS.map((option) => (
                <option value={option.type} key={option.type}>
                  {effectName(option.type)}
                </option>
              ))}
            </select>
          </label>
          <VisualKeyframeEditor item={item} fps={fps} playheadFrame={playheadFrame} onPatch={onPatch} onSeek={onSeek} />
          <VisualTransformEditor item={item} playheadFrame={playheadFrame} onPatch={onPatch} />
          <VisualKeyingEditor item={item} onPatch={onPatch} />
        </>
      )}
      <div className="two-buttons">
        <button className="command" onClick={onSplit}>
          <Scissors size={16} />
          拆分
        </button>
        <button className="command danger" onClick={onDelete}>
          <Trash2 size={16} />
          删除
        </button>
      </div>
      <small className="muted">{formatTime(item.startFrame, fps)} - {formatTime(item.startFrame + item.durationFrames, fps)}</small>
    </section>
  )
}

function ProjectOverviewInspector({
  project,
  preset,
  totalFrames,
  fps,
  lastExport
}: {
  project: ProjectFile
  preset: ExportPreset
  totalFrames: number
  fps: number
  lastExport: RenderResult | null
}): JSX.Element {
  const timelineAssetIds = new Set(project.timeline.map((item) => item.assetId).filter(Boolean))
  const projectAssetIds = new Set(project.assets.map((asset) => asset.id))
  const missingCount = [...timelineAssetIds].filter((assetId) => !projectAssetIds.has(String(assetId))).length
  const visualCount = project.timeline.filter((item) => item.type === 'visual').length
  const subtitleCount = project.timeline.filter((item) => item.type === 'subtitle').length
  const audioCount = project.timeline.filter((item) => ['voice', 'music', 'sfx'].includes(item.type)).length
  const mutedTracks = project.tracks.filter((track) => track.muted).length

  return (
    <section className="inspector project-overview-inspector">
      <PanelTitle icon={<SlidersHorizontal />} title="项目状态" />
      <div className="overview-title">
        <strong>{project.title}</strong>
        <span>{preset.name} · {preset.width}x{preset.height}</span>
      </div>
      <div className="overview-metrics">
        <Metric label="总时长" value={formatTime(totalFrames, fps)} />
        <Metric label="画面片段" value={String(visualCount)} />
        <Metric label="字幕" value={String(subtitleCount)} />
        <Metric label="音频" value={String(audioCount)} />
      </div>
      <div className={missingCount ? 'quality-card warning' : 'quality-card ok'}>
        <strong>{missingCount ? '需要处理' : '状态良好'}</strong>
        <span>{missingCount ? `有 ${missingCount} 个时间线素材未找到` : '时间线素材完整，可以继续剪辑或导出。'}</span>
      </div>
      <div className="overview-rules">
        <span>背景素材自动进入最底层背景轨。</span>
        <span>角色绿幕保持原始比例，不随横竖屏拉伸。</span>
        <span>拖入素材时，当前播放头就是素材第一帧。</span>
        {mutedTracks > 0 && <span>{mutedTracks} 条轨道处于隐藏或静音状态。</span>}
      </div>
      {lastExport && (
        <div className="last-export-mini">
          <strong>最近导出</strong>
          <span>{lastExport.outputPath}</span>
        </div>
      )}
    </section>
  )
}

function Timeline({
  project,
  availableAssets,
  totalFrames,
  fps,
  selectedItemId,
  selectedTrackId,
  playheadFrame,
  activeGroup,
  soloGroup,
  onSelect,
  onSelectTrack,
  onSeek,
  onPatchItem,
  onPatchTrack,
  onPatchGroup,
  onAddTrack,
  onDeleteTrack,
  onReorderTrack,
  onActiveGroupChange,
  onSoloGroupChange,
  onSelectGroupItems,
  onTotalFramesChange,
  timelineZoom,
  onTimelineZoom,
  snapEnabled,
  onSnapToggle,
  razorMode,
  onRazorModeChange,
  onCutItemAtFrame,
  onItemContextMenu,
  onDropAsset
}: {
  project: ProjectFile
  availableAssets: Asset[]
  totalFrames: number
  fps: number
  selectedItemId: string | null
  selectedTrackId: string | null
  playheadFrame: number
  activeGroup: TrackGroupFilter
  soloGroup: TrackGroupId | null
  onSelect: (id: string) => void
  onSelectTrack: (trackId: string, clearItem?: boolean) => void
  onSeek: (frame: number) => void
  onPatchItem: (id: string, patch: Partial<TimelineItem>) => void
  onPatchTrack: (trackId: string, patch: Partial<TimelineTrack>) => void
  onPatchGroup: (groupId: TrackGroupId, patch: Partial<TimelineTrack>) => void
  onAddTrack: (groupId?: TrackGroupId, kind?: TrackKind) => void
  onDeleteTrack: (trackId: string) => void
  onReorderTrack: (sourceTrackId: string, targetTrackId: string, placement: 'before' | 'after') => void
  onActiveGroupChange: (group: TrackGroupFilter) => void
  onSoloGroupChange: (group: TrackGroupId | null) => void
  onSelectGroupItems: (groupId: TrackGroupId) => void
  onTotalFramesChange: (frames: number) => void
  timelineZoom: number
  onTimelineZoom: (zoom: number) => void
  snapEnabled: boolean
  onSnapToggle: () => void
  razorMode: boolean
  onRazorModeChange: (value: boolean) => void
  onCutItemAtFrame: (itemId: string, frame: number) => void
  onItemContextMenu: (id: string, clientX: number, clientY: number) => void
  onDropAsset: (assetId: string, trackId: string, frame: number) => void
}): JSX.Element {
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'trim-start' | 'trim-end'
    item: TimelineItem
    startX: number
    startFrame: number
    durationFrames: number
    sourceInFrame: number
    laneWidth: number
    latestPatch: Partial<TimelineItem>
  } | null>(null)
  const [durationDrag, setDurationDrag] = useState<{ startX: number; startFrames: number; laneWidth: number } | null>(null)
  const [trackDropTarget, setTrackDropTarget] = useState<string | null>(null)
  const [assetDropPreview, setAssetDropPreview] = useState<{
    trackId: string
    frame: number
    durationFrames: number
    valid: boolean
    label?: string
  } | null>(null)
  const rulerTicks = makeRulerTicks(totalFrames, fps)
  const visibleGroups = activeGroup === 'all' ? TRACK_GROUPS : TRACK_GROUPS.filter((group) => group.id === activeGroup)

  useEffect(() => {
    if (!dragState) return
    const activeDrag = dragState

    function onPointerMove(event: globalThis.PointerEvent): void {
      const deltaFrames = Math.round(((event.clientX - activeDrag.startX) / activeDrag.laneWidth) * totalFrames)
      let patch: Partial<TimelineItem>

      if (activeDrag.mode === 'move') {
        const lane = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-track-id]')
        const trackId = lane?.dataset.trackId
        patch = {
          startFrame: Math.max(0, activeDrag.startFrame + deltaFrames),
          ...(trackId && canMoveItemToTrack(project, activeDrag.item, trackId) ? { trackId } : {})
        }
      } else if (activeDrag.mode === 'trim-start') {
        const maxDelta = activeDrag.durationFrames - 1
        const appliedDelta = Math.max(-activeDrag.startFrame, Math.min(deltaFrames, maxDelta))
        patch = {
          startFrame: activeDrag.startFrame + appliedDelta,
          durationFrames: activeDrag.durationFrames - appliedDelta,
          sourceInFrame: Math.max(0, activeDrag.sourceInFrame + appliedDelta)
        }
      } else {
        patch = {
          durationFrames: Math.max(1, activeDrag.durationFrames + deltaFrames)
        }
      }

      if (snapEnabled && !event.altKey) {
        patch = snapTimelinePatch({
          project,
          item: activeDrag.item,
          mode: activeDrag.mode,
          patch,
          startFrame: activeDrag.startFrame,
          durationFrames: activeDrag.durationFrames,
          sourceInFrame: activeDrag.sourceInFrame,
          trackId: patch.trackId || activeDrag.item.trackId,
          playheadFrame,
          rulerFrames: rulerTicks.map((tick) => tick.frame),
          thresholdFrames: snapThresholdFrames(activeDrag.laneWidth, totalFrames, fps)
        })
      }

      setDragState((current) => (current ? { ...current, latestPatch: patch } : current))
      onPatchItem(activeDrag.item.id, patch)
    }

    function onPointerUp(): void {
      setDragState(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, fps, onPatchItem, playheadFrame, project, rulerTicks, snapEnabled, totalFrames])

  useEffect(() => {
    if (!durationDrag) return
    const activeDrag = durationDrag

    function onPointerMove(event: globalThis.PointerEvent): void {
      const deltaFrames = Math.round(((event.clientX - activeDrag.startX) / Math.max(1, activeDrag.laneWidth)) * totalFrames)
      onTotalFramesChange(Math.max(fps * 4, activeDrag.startFrames + deltaFrames))
    }

    function onPointerUp(): void {
      setDurationDrag(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [durationDrag, fps, onTotalFramesChange, totalFrames])

  function seekFromPointer(event: PointerEvent<HTMLDivElement>): void {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    onSeek(Math.round(ratio * totalFrames))
  }

  function frameFromClientX(element: HTMLElement, clientX: number): number {
    const bounds = element.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width))
    return Math.round(ratio * totalFrames)
  }

  function dragHasType(event: DragEvent<HTMLElement>, type: string): boolean {
    return Array.from(event.dataTransfer.types).includes(type)
  }

  function handleTrackDragStart(event: DragEvent<HTMLElement>, track: TimelineTrack): void {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(TRACK_DRAG_MIME, track.id)
    event.dataTransfer.setData('text/plain', track.id)
  }

  function handleTrackDragOver(event: DragEvent<HTMLElement>, trackId: string): void {
    if (!dragHasType(event, TRACK_DRAG_MIME)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setTrackDropTarget(trackId)
  }

  function handleTrackDrop(event: DragEvent<HTMLElement>, targetTrack: TimelineTrack): void {
    if (!dragHasType(event, TRACK_DRAG_MIME)) return
    event.preventDefault()
    event.stopPropagation()
    const sourceTrackId = event.dataTransfer.getData(TRACK_DRAG_MIME)
    if (!sourceTrackId || sourceTrackId === targetTrack.id) {
      setTrackDropTarget(null)
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
    onReorderTrack(sourceTrackId, targetTrack.id, placement)
    setTrackDropTarget(null)
  }

  function assetIdFromDrag(event: DragEvent<HTMLElement>): string {
    return event.dataTransfer.getData('application/x-cat-meme-asset') || event.dataTransfer.getData('text/plain')
  }

  function assetDropDuration(asset: Asset): number {
    const seconds = asset.type === 'audio' ? asset.duration || 4 : asset.duration || 2.4
    return Math.max(fps, Math.round(seconds * fps))
  }

  function assetDropFrame(rawFrame: number, durationFrames: number, trackId: string, altKey: boolean, laneWidth: number): { frame: number; label?: string } {
    const safeFrame = clampNumber(rawFrame, 0, Math.max(0, totalFrames - 1))
    if (!snapEnabled || altKey) return { frame: safeFrame }
    const trackItems = project.timeline.filter((item) => item.trackId === trackId)
    const candidates = [
      { frame: playheadFrame, label: '播放头' },
      ...trackItems.flatMap((item) => [
        { frame: item.startFrame, label: '后一个开头' },
        { frame: item.startFrame + item.durationFrames, label: '前一个结尾' },
        { frame: item.startFrame - durationFrames, label: '贴齐前一个开头' }
      ])
    ]
    const threshold = snapThresholdFrames(laneWidth, totalFrames, fps)
    let winner: { frame: number; label?: string } | null = null
    let distance = threshold + 1
    candidates.forEach((candidate) => {
      const nextDistance = Math.abs(candidate.frame - safeFrame)
      if (candidate.frame >= 0 && nextDistance <= threshold && nextDistance < distance) {
        winner = candidate
        distance = nextDistance
      }
    })
    return winner || { frame: safeFrame }
  }

  function updateAssetDropPreview(event: DragEvent<HTMLDivElement>, track: TimelineTrack): void {
    if (dragHasType(event, TRACK_DRAG_MIME)) return
    const assetId = assetIdFromDrag(event)
    if (!assetId) return
    const asset = availableAssets.find((item) => item.id === assetId)
    if (!asset) return
    event.preventDefault()
    const rawFrame = frameFromClientX(event.currentTarget, event.clientX)
    const durationFrames = assetDropDuration(asset)
    const snap = assetDropFrame(rawFrame, durationFrames, track.id, event.altKey, event.currentTarget.getBoundingClientRect().width)
    setAssetDropPreview({
      trackId: track.id,
      frame: snap.frame,
      durationFrames,
      valid: canDropAssetOnTimelineTrack(project, asset, track),
      label: snap.label
    })
    event.dataTransfer.dropEffect = track.locked || !canDropAssetOnTimelineTrack(project, asset, track) ? 'none' : 'copy'
  }

  function handleAssetDrop(event: DragEvent<HTMLDivElement>, trackId: string): void {
    event.preventDefault()
    const track = project.tracks.find((track) => track.id === trackId)
    if (!track?.id || track.locked) return
    const assetId = assetIdFromDrag(event)
    if (!assetId) return
    const asset = availableAssets.find((item) => item.id === assetId)
    if (!asset || !canDropAssetOnTimelineTrack(project, asset, track)) {
      setAssetDropPreview(null)
      return
    }
    const frame = assetDropPreview?.trackId === trackId ? assetDropPreview.frame : frameFromClientX(event.currentTarget, event.clientX)
    onDropAsset(assetId, trackId, frame)
    setAssetDropPreview(null)
  }

  function beginDrag(event: PointerEvent<HTMLElement>, item: TimelineItem, mode: 'move' | 'trim-start' | 'trim-end'): void {
    event.preventDefault()
    event.stopPropagation()
    const track = project.tracks.find((track) => track.id === item.trackId)
    if (track?.locked) return
    const lane = event.currentTarget.closest<HTMLElement>('.track-lane')
    setDragState({
      mode,
      item,
      startX: event.clientX,
      startFrame: item.startFrame,
      durationFrames: item.durationFrames,
      sourceInFrame: item.sourceInFrame,
      laneWidth: lane?.getBoundingClientRect().width || 960,
      latestPatch: {}
    })
    onSelect(item.id)
  }

  function cutItemFromPointer(event: PointerEvent<HTMLElement>, item: TimelineItem): void {
    event.preventDefault()
    event.stopPropagation()
    const track = project.tracks.find((track) => track.id === item.trackId)
    if (track?.locked) return
    const lane = event.currentTarget.closest<HTMLElement>('.track-lane')
    const frame = frameFromClientX(lane || event.currentTarget, event.clientX)
    onCutItemAtFrame(item.id, frame)
  }

  function beginDurationDrag(event: PointerEvent<HTMLElement>): void {
    event.preventDefault()
    event.stopPropagation()
    const lane = event.currentTarget.closest<HTMLElement>('.ruler-lane')
    setDurationDrag({
      startX: event.clientX,
      startFrames: totalFrames,
      laneWidth: lane?.getBoundingClientRect().width || 960
    })
  }

  return (
    <div
      className={`timeline ${razorMode ? 'razor-mode' : ''} ${dragState ? 'dragging-item' : ''}`}
      onWheel={(event) => {
        if (!event.ctrlKey) return
        event.preventDefault()
        onTimelineZoom(clampNumber(timelineZoom * (event.deltaY < 0 ? 1.12 : 0.88), 1, 4))
      }}
    >
      <div className="timeline-scale" style={{ width: `${timelineZoom * 100}%` }}>
        <div className="track-group-tabs">
          <button className={activeGroup === 'all' ? 'track-group-tab active' : 'track-group-tab'} onClick={() => onActiveGroupChange('all')}>
            <Layers size={14} />
            全部
            <span>{project.timeline.length}</span>
          </button>
          {TRACK_GROUPS.map((group) => {
            const groupTrackIds = new Set(project.tracks.filter((track) => trackGroupId(track) === group.id).map((track) => track.id))
            const count = project.timeline.filter((item) => groupTrackIds.has(item.trackId)).length
            return (
              <button
                key={group.id}
                className={`${activeGroup === group.id ? 'track-group-tab active' : 'track-group-tab'} ${soloGroup === group.id ? 'solo' : ''}`}
                onClick={() => onActiveGroupChange(group.id)}
              >
                {group.label}
                <span>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="timeline-add-row">
          <div className="timeline-track-actions">
            <button className="command ghost compact" onClick={() => onAddTrack(activeGroup === 'all' ? 'role' : activeGroup)}>
              <Plus size={16} />
              {activeGroup === 'all' ? '添加角色轨' : `添加${trackGroupLabel(activeGroup)}轨`}
            </button>
            <button className={snapEnabled ? 'track-icon-button active' : 'track-icon-button'} title="磁吸贴边" onClick={onSnapToggle}>
              <Magnet size={14} />
            </button>
            <button className={razorMode ? 'track-icon-button active' : 'track-icon-button'} title="剃刀工具 C / 选择工具 V" onClick={() => onRazorModeChange(!razorMode)}>
              <Scissors size={14} />
            </button>
          </div>
          <div className="timeline-drop-hint">视觉层级：越靠下越在上层；拖动轨道左侧把手调整上下层。</div>
        </div>
        <div className="time-ruler">
          <div className="ruler-corner">轨道控制</div>
          <div className="ruler-lane" onPointerDown={seekFromPointer}>
            <div className="playhead" style={{ left: `${(playheadFrame / totalFrames) * 100}%` }} />
            {rulerTicks.map((tick) => (
              <span className="ruler-tick" style={{ left: `${tick.left}%` }} key={tick.frame}>
                {tick.label}
              </span>
            ))}
            <button className="project-end-handle" style={{ left: '100%' }} title="拖动延长时间轴" onPointerDown={beginDurationDrag} />
          </div>
        </div>
        {visibleGroups.map((group) => {
          const tracks = project.tracks.filter((track) => trackGroupId(track) === group.id)
          const trackIds = new Set(tracks.map((track) => track.id))
          const groupItems = project.timeline.filter((item) => trackIds.has(item.trackId))
          const allLocked = tracks.length > 0 && tracks.every((track) => track.locked)
          const allMuted = tracks.length > 0 && tracks.every((track) => track.muted)
          return (
            <div className="timeline-group-block" key={group.id}>
              <div className={`track-group-header ${soloGroup === group.id ? 'solo' : ''}`}>
                <div className="track-group-title">
                  <span className="track-group-short">{group.shortLabel}</span>
                  <strong>{group.label}</strong>
                  <small>{tracks.length} 轨 / {groupItems.length} 段</small>
                </div>
                <div className="track-group-controls">
                  <button className={allLocked ? 'track-icon-button active' : 'track-icon-button'} title={allLocked ? '解锁整组' : '锁定整组'} onClick={() => onPatchGroup(group.id, { locked: !allLocked })}>
                    {allLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button className={allMuted ? 'track-icon-button active' : 'track-icon-button'} title={group.output === 'audio' ? (allMuted ? '恢复整组声音' : '静音整组') : allMuted ? '显示整组' : '隐藏整组'} onClick={() => onPatchGroup(group.id, { muted: !allMuted })}>
                    {group.output === 'audio' ? (allMuted ? <VolumeX size={14} /> : <Volume2 size={14} />) : allMuted ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button className={soloGroup === group.id ? 'track-icon-button active' : 'track-icon-button'} title={soloGroup === group.id ? '取消预览独奏' : '预览独奏组'} onClick={() => onSoloGroupChange(soloGroup === group.id ? null : group.id)}>
                    <Sparkles size={14} />
                  </button>
                  <button className="track-icon-button" title="定位组内素材" onClick={() => onSelectGroupItems(group.id)}>
                    <Layers size={14} />
                  </button>
                  {group.id === 'sfx' ? (
                    <>
                      <button className="group-add-button" onClick={() => onAddTrack(group.id, 'sfx')}>+ 音效</button>
                      <button className="group-add-button" onClick={() => onAddTrack(group.id, 'voice')}>+ 配音</button>
                    </>
                  ) : (
                    <button className="group-add-button" onClick={() => onAddTrack(group.id)}>+ 轨道</button>
                  )}
                </div>
              </div>
              {tracks.map((track) => {
                const items = project.timeline.filter((item) => item.trackId === track.id)
                return (
                  <div
                    className={`track-row ${selectedTrackId === track.id ? 'selected-track' : ''} ${trackDropTarget === track.id ? 'track-drop-target' : ''}`}
                    key={track.id}
                    onDragOver={(event) => handleTrackDragOver(event, track.id)}
                    onDragLeave={() => setTrackDropTarget((current) => (current === track.id ? null : current))}
                    onDrop={(event) => handleTrackDrop(event, track)}
                  >
                    <div className="track-label" title={displayTrackName(track)} onPointerDown={() => onSelectTrack(track.id)}>
                      <div className="track-name-block">
                        <span
                          className="track-drag-handle"
                          draggable
                          title="拖动调整轨道上下层"
                          onDragStart={(event) => handleTrackDragStart(event, track)}
                        >
                          <GripVertical size={13} />
                        </span>
                        <span className="track-kind">{trackGroupDefinition(trackGroupId(track)).shortLabel}</span>
                        <strong>{displayTrackName(track)}</strong>
                      </div>
                      <div className="track-controls">
                        <button className={track.locked ? 'track-icon-button active' : 'track-icon-button'} title={track.locked ? '解锁轨道' : '锁定轨道'} onClick={() => onPatchTrack(track.id, { locked: !track.locked })}>
                          {track.locked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                        <button className={track.muted ? 'track-icon-button active' : 'track-icon-button'} title={track.muted ? '恢复轨道输出' : track.kind === 'visual' || track.kind === 'subtitle' ? '隐藏画面' : '静音轨道'} onClick={() => onPatchTrack(track.id, { muted: !track.muted })}>
                          {track.kind === 'visual' || track.kind === 'subtitle' ? (track.muted ? <EyeOff size={14} /> : <Eye size={14} />) : track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                        <button className="track-icon-button danger" title="删除轨道" onClick={() => onDeleteTrack(track.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div
                      className={`track-lane ${track.locked ? 'locked' : ''} ${track.muted ? 'muted' : ''}`}
                      data-track-id={track.id}
                      onPointerDown={(event) => {
                        onSelectTrack(track.id)
                        seekFromPointer(event)
                      }}
                      onDragOver={(event) => {
                        if (dragHasType(event, TRACK_DRAG_MIME)) return
                        updateAssetDropPreview(event, track)
                      }}
                      onDragLeave={() => {
                        setAssetDropPreview((current) => (current?.trackId === track.id ? null : current))
                      }}
                      onDrop={(event) => {
                        if (dragHasType(event, TRACK_DRAG_MIME)) return
                        handleAssetDrop(event, track.id)
                      }}
                    >
                      <div className="track-playhead" style={{ left: `${(playheadFrame / totalFrames) * 100}%` }} />
                      {assetDropPreview?.trackId === track.id && (
                        <>
                          <div className={assetDropPreview.valid ? 'timeline-drop-ghost' : 'timeline-drop-ghost invalid'} style={{
                            left: `${(assetDropPreview.frame / totalFrames) * 100}%`,
                            width: `${Math.max(1.2, (assetDropPreview.durationFrames / totalFrames) * 100)}%`
                          }}>
                            {assetDropPreview.valid ? assetDropPreview.label || '投放' : '不可投放'}
                          </div>
                          <div className={assetDropPreview.valid ? 'timeline-snap-preview' : 'timeline-snap-preview invalid'} style={{ left: `${(assetDropPreview.frame / totalFrames) * 100}%` }} />
                        </>
                      )}
                      {items.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`timeline-item kind-${item.type} ${selectedItemId === item.id ? 'selected' : ''}`}
                          style={{
                            left: `${(item.startFrame / totalFrames) * 100}%`,
                            width: `${Math.max(1.2, (item.durationFrames / totalFrames) * 100)}%`
                          }}
                          onPointerDown={(event) => {
                            if (razorMode) {
                              cutItemFromPointer(event, item)
                              return
                            }
                            beginDrag(event, item, 'move')
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onContextMenu={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onItemContextMenu(item.id, event.clientX, event.clientY)
                          }}
                          title={`${item.label} · ${item.durationFrames} 帧`}
                        >
                          <span className="resize-handle left" onPointerDown={(event) => (razorMode ? cutItemFromPointer(event, item) : beginDrag(event, item, 'trim-start'))} />
                          <span>{item.label}</span>
                          <span className="resize-handle right" onPointerDown={(event) => (razorMode ? cutItemFromPointer(event, item) : beginDrag(event, item, 'trim-end'))} />
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              {tracks.length === 0 && (
                <button className="empty-group-row" onClick={() => onAddTrack(group.id)}>
                  <Plus size={14} />
                  添加{group.label}轨道
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ToolDrawer({ title, icon, children, onClose }: { title: string; icon: JSX.Element; children: ReactNode; onClose: () => void }): JSX.Element {
  return (
    <div className="tool-drawer-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="tool-drawer" onPointerDown={(event) => event.stopPropagation()}>
        <div className="tool-drawer-head">
          <PanelTitle icon={icon} title={title} />
          <button className="icon-button" title="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="tool-drawer-body">{children}</div>
      </aside>
    </div>
  )
}

function ExportDrawerContent({
  project,
  preset,
  settings,
  workspace,
  lastExport,
  onChangeCustomPreset,
  onChooseExportDir,
  onPreview,
  onExport,
  onExportAs
}: {
  project: ProjectFile
  preset: ExportPreset
  settings: AppSettings
  workspace: WorkspaceInfo
  lastExport: RenderResult | null
  onChangeCustomPreset: (patch: Partial<ExportPreset>) => void
  onChooseExportDir: () => void
  onPreview: () => void
  onExport: () => void
  onExportAs: () => void
}): JSX.Element {
  const exportDir = settings.defaultExportDir || workspace.outputDir
  return (
    <div className="right-content">
      <div className="metric-grid">
        <Metric label="分辨率" value={`${preset.width} x ${preset.height}`} />
        <Metric label="帧率" value={`${preset.fps} fps`} />
        <Metric label="视频码率" value={preset.videoBitrate} />
        <Metric label="音频码率" value={preset.audioBitrate} />
      </div>
      {project.exportPresetId === 'custom' && (
        <CustomPresetPanel preset={preset} onChange={onChangeCustomPreset} />
      )}
      <div className="export-dir-card">
        <span>默认导出目录</span>
        <strong title={exportDir}>{exportDir}</strong>
        <div className="two-buttons">
          <button className="command ghost" onClick={onChooseExportDir}>
            <FolderOpen size={16} />
            选择目录
          </button>
          <button className="command ghost" onClick={() => void window.catMeme.openPath(exportDir)}>
            <Folder size={16} />
            打开目录
          </button>
        </div>
      </div>
      <button className="command wide" onClick={onPreview}>
        <Play size={16} />
        生成预览
      </button>
      <button className="command primary wide" onClick={onExport}>
        <Rocket size={16} />
        导出 MP4
      </button>
      <button className="command wide" onClick={onExportAs}>
        <Save size={16} />
        另存为...
      </button>
      {lastExport && (
        <div className="export-result">
          <strong>最近导出</strong>
          <span>{lastExport.outputPath}</span>
          <button className="command wide" onClick={() => window.catMeme.showItem(lastExport.outputPath)}>
            <FolderOpen size={16} />
            打开位置
          </button>
        </div>
      )}
    </div>
  )
}

function SettingsPanel({ settings, onSave }: { settings: AppSettings; onSave: (settings: AppSettings) => Promise<void> }): JSX.Element {
  const [draft, setDraft] = useState(settings)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  function update(path: string, value: string): void {
    const [group, key] = path.split('.') as ['openAi' | 'providers', string]
    setDraft((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value
      }
    }))
  }

  return (
    <div className="right-content">
      <PanelTitle icon={<Settings />} title="OpenAI 兼容" />
      <label className="field">
        <span>Base URL</span>
        <input value={draft.openAi.baseUrl} onChange={(event) => update('openAi.baseUrl', event.target.value)} />
      </label>
      <label className="field">
        <span>API Key</span>
        <input type="password" value={draft.openAi.apiKey} onChange={(event) => update('openAi.apiKey', event.target.value)} />
      </label>
      <div className="two-buttons">
        <label className="field">
          <span>文本模型</span>
          <input value={draft.openAi.textModel} onChange={(event) => update('openAi.textModel', event.target.value)} />
        </label>
        <label className="field">
          <span>TTS 声音</span>
          <input value={draft.openAi.ttsVoice} onChange={(event) => update('openAi.ttsVoice', event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>TTS 模型</span>
        <input value={draft.openAi.ttsModel} onChange={(event) => update('openAi.ttsModel', event.target.value)} />
      </label>

      <PanelTitle icon={<Search />} title="素材 API" />
      <label className="field">
        <span>Pexels Key</span>
        <input type="password" value={draft.providers.pexelsApiKey} onChange={(event) => update('providers.pexelsApiKey', event.target.value)} />
      </label>
      <label className="field">
        <span>Pixabay Key</span>
        <input type="password" value={draft.providers.pixabayApiKey} onChange={(event) => update('providers.pixabayApiKey', event.target.value)} />
      </label>
      <div className="two-buttons">
        <label className="field">
          <span>Imgflip 用户</span>
          <input value={draft.providers.imgflipUsername} onChange={(event) => update('providers.imgflipUsername', event.target.value)} />
        </label>
        <label className="field">
          <span>Imgflip 密码</span>
          <input type="password" value={draft.providers.imgflipPassword} onChange={(event) => update('providers.imgflipPassword', event.target.value)} />
        </label>
      </div>
      <button className="command primary wide" onClick={() => void onSave(draft)}>
        <Save size={16} />
        保存设置
      </button>
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }): JSX.Element {
  return (
    <label className="field compact">
      <span>{label}</span>
      <input type="number" step={1} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value) || 0)} />
    </label>
  )
}

function VisualKeyframeEditor({
  item,
  fps,
  playheadFrame,
  onPatch,
  onSeek
}: {
  item: TimelineItem
  fps: number
  playheadFrame: number
  onPatch: (patch: Partial<TimelineItem>) => void
  onSeek: (frame: number) => void
}): JSX.Element {
  const localFrame = localFrameForItem(item, playheadFrame)
  const keyframes = visualKeyframes(item)
  const currentKeyframe = keyframes.find((keyframe) => keyframe.frame === localFrame)
  const previous = [...keyframes].reverse().find((keyframe) => keyframe.frame < localFrame)
  const next = keyframes.find((keyframe) => keyframe.frame > localFrame)
  const transform = visualTransformAtFrame(item, localFrame)

  return (
    <div className="transform-editor keyframe-editor">
      <div className="panel-title mini">
        <Sparkles />
        <strong>关键帧</strong>
      </div>
      <div className="keyframe-status">
        <span>当前 {formatTime(item.startFrame + localFrame, fps)}</span>
        <strong>{currentKeyframe ? '已有关键帧' : `${keyframes.length} 个关键帧`}</strong>
      </div>
      <div className="keyframe-actions">
        <button className="command compact" onClick={() => onPatch({ keyframes: upsertVisualKeyframe(item, localFrame, transform) })}>
          {currentKeyframe ? '更新' : '添加'}
        </button>
        <button className="command compact" disabled={!previous} onClick={() => previous && onSeek(item.startFrame + previous.frame)}>
          上一帧
        </button>
        <button className="command compact" disabled={!next} onClick={() => next && onSeek(item.startFrame + next.frame)}>
          下一帧
        </button>
        <button className="command compact danger" disabled={!currentKeyframe} onClick={() => onPatch({ keyframes: removeVisualKeyframe(item, localFrame) })}>
          删除
        </button>
      </div>
      <small className="muted">支持位置、缩放、旋转、透明度。当前帧有关键帧时，下面的变换会直接更新这一帧。</small>
    </div>
  )
}

function VisualTransformEditor({
  item,
  playheadFrame,
  onPatch
}: {
  item: TimelineItem
  playheadFrame: number
  onPatch: (patch: Partial<TimelineItem>) => void
}): JSX.Element {
  const localFrame = localFrameForItem(item, playheadFrame)
  const transform = visualTransformAtFrame(item, localFrame)
  function patchTransform(patch: Partial<ReturnType<typeof normalizeTransform>>): void {
    onPatch(patchVisualTransformAtFrame(item, localFrame, patch))
  }

  return (
    <div className="transform-editor">
      <div className="panel-title mini">
        <Layers />
        <strong>画面变换</strong>
      </div>
      <div className="number-grid">
        <NumberField label="X 位置" value={Math.round(transform.x)} onChange={(value) => patchTransform({ x: value })} />
        <NumberField label="Y 位置" value={Math.round(transform.y)} onChange={(value) => patchTransform({ y: value })} />
        <label className="field compact">
          <span>缩放</span>
          <input
            type="number"
            step={0.05}
            min={0.08}
            max={4}
            value={transform.scale}
            onChange={(event) => patchTransform({ scale: Number(event.target.value) || 1 })}
          />
        </label>
        <label className="field compact">
          <span>透明度</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={transform.opacity}
            onChange={(event) => patchTransform({ opacity: Number(event.target.value) || 0 })}
          />
        </label>
        <NumberField label="旋转角度" value={Math.round(transform.rotation)} onChange={(value) => patchTransform({ rotation: value })} />
        <label className="toggle-field compact-toggle">
          <input type="checkbox" checked={transform.flipX} onChange={(event) => patchTransform({ flipX: event.target.checked })} />
          <span>水平对称</span>
        </label>
        <label className="toggle-field compact-toggle">
          <input type="checkbox" checked={transform.flipY} onChange={(event) => patchTransform({ flipY: event.target.checked })} />
          <span>垂直对称</span>
        </label>
      </div>
      <div className="transform-presets">
        <button onClick={() => patchTransform({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 })}>全屏</button>
        <button onClick={() => patchTransform({ x: -260, y: 140, scale: 0.42, rotation: 0, opacity: 1 })}>左下角色</button>
        <button onClick={() => patchTransform({ x: 260, y: 140, scale: 0.42, rotation: 0, opacity: 1 })}>右下角色</button>
        <button onClick={() => patchTransform({ x: 0, y: -420, scale: 0.34, rotation: 0, opacity: 1 })}>顶部表情</button>
        <button onClick={() => patchTransform({ rotation: transform.rotation - 15 })}>左旋 15°</button>
        <button onClick={() => patchTransform({ rotation: transform.rotation + 15 })}>右旋 15°</button>
      </div>
    </div>
  )
}

function DialogueInspector({
  item,
  onPatch
}: {
  item: TimelineItem
  onPatch: (patch: Partial<TimelineItem>) => void
}): JSX.Element {
  return (
    <div className="transform-editor">
      <div className="panel-title mini">
        <Captions />
        <strong>角色对白</strong>
      </div>
      <label className="field compact">
        <span>角色名称</span>
        <input value={item.speakerName || ''} onChange={(event) => onPatch({ speakerName: event.target.value })} />
      </label>
      <label className="toggle-field">
        <input
          type="checkbox"
          checked={item.speakerVisible ?? Boolean(item.speakerName)}
          onChange={(event) => onPatch({ speakerVisible: event.target.checked })}
        />
        <span>显示角色名称</span>
      </label>
      <label className="field compact">
        <span>角色名称位置</span>
        <select
          value={item.speakerPosition || 'bottom'}
          onChange={(event) => onPatch({ speakerPosition: event.target.value as TimelineItem['speakerPosition'] })}
        >
          <option value="top">上方</option>
          <option value="middle">中间</option>
          <option value="bottom">下方</option>
        </select>
      </label>
      <label className="field compact">
        <span>对白字幕</span>
        <textarea value={item.text || ''} onChange={(event) => onPatch({ text: event.target.value })} />
      </label>
      <label className="field compact">
        <span>对白字幕位置</span>
        <select
          value={item.style?.position || 'top'}
          onChange={(event) => onPatch({ style: { ...item.style, position: event.target.value as ProjectFile['subtitleStyle']['position'] } })}
        >
          <option value="top">上方</option>
          <option value="middle">中间</option>
          <option value="bottom">下方</option>
        </select>
      </label>
    </div>
  )
}

function SubtitleStylePanel({
  style,
  onChange
}: {
  style: ProjectFile['subtitleStyle']
  onChange: (patch: Partial<ProjectFile['subtitleStyle']>) => void
}): JSX.Element {
  return (
    <div className="transform-editor">
      <div className="panel-title mini">
        <Captions />
        <strong>字幕样式</strong>
      </div>
      <div className="preset-chips subtitle-presets">
        {SUBTITLE_STYLE_PRESETS.map((preset) => (
          <button key={preset.id} onClick={() => onChange(preset.style)}>
            {preset.label}
          </button>
        ))}
      </div>
      <div className="number-grid">
        <label className="field compact">
          <span>字体</span>
          <input value={style.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value })} />
        </label>
        <NumberField label="字号" value={style.fontSize} onChange={(value) => onChange({ fontSize: Math.max(12, value) })} />
        <label className="field compact">
          <span>文字颜色</span>
          <input type="color" value={style.color} onChange={(event) => onChange({ color: event.target.value })} />
        </label>
        <label className="field compact">
          <span>边框颜色</span>
          <input type="color" value={style.outlineColor} onChange={(event) => onChange({ outlineColor: event.target.value })} />
        </label>
        <NumberField label="边框宽度" value={style.outlineWidth} onChange={(value) => onChange({ outlineWidth: Math.max(0, value) })} />
        <label className="field compact">
          <span>背景颜色</span>
          <input type="color" value={style.backgroundColor} onChange={(event) => onChange({ backgroundColor: event.target.value })} />
        </label>
        <label className="field compact">
          <span>默认位置</span>
          <select value={style.position} onChange={(event) => onChange({ position: event.target.value as ProjectFile['subtitleStyle']['position'] })}>
            <option value="top">上方</option>
            <option value="middle">中间</option>
            <option value="bottom">下方</option>
          </select>
        </label>
      </div>
      <label className="toggle-field">
        <input type="checkbox" checked={style.background} onChange={(event) => onChange({ background: event.target.checked })} />
        <span>字幕背景</span>
      </label>
      <div className="subtitle-style-preview">
        <span style={previewSubtitleCss(style)}>字幕预览：那你把你全家人都叫过来一趟</span>
      </div>
    </div>
  )
}

function VisualKeyingEditor({
  item,
  onPatch
}: {
  item: TimelineItem
  onPatch: (patch: Partial<TimelineItem>) => void
}): JSX.Element {
  const keying = normalizeKeying(item.keying)
  function patchKeying(patch: Partial<ReturnType<typeof normalizeKeying>>): void {
    onPatch({ keying: { ...keying, ...patch } })
  }

  return (
    <div className="transform-editor">
      <label className="toggle-field">
        <input type="checkbox" checked={keying.enabled} onChange={(event) => patchKeying({ enabled: event.target.checked })} />
        <span>绿幕抠像</span>
      </label>
      <div className="number-grid">
        <label className="field compact">
          <span>颜色</span>
          <input type="color" value={keying.color} onChange={(event) => patchKeying({ color: event.target.value })} />
        </label>
        <label className="field compact">
          <span>强度</span>
          <input
            type="number"
            min={0.01}
            max={1}
            step={0.01}
            value={keying.similarity}
            onChange={(event) => patchKeying({ similarity: Number(event.target.value) || 0.22 })}
          />
        </label>
        <label className="field compact">
          <span>边缘混合</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={keying.blend}
            onChange={(event) => patchKeying({ blend: Number(event.target.value) || 0.08 })}
          />
        </label>
        <button className="command ghost" onClick={() => patchKeying({ enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 })}>
          绿幕默认
        </button>
      </div>
    </div>
  )
}

function CustomPresetPanel({ preset, onChange }: { preset: ExportPreset; onChange: (patch: Partial<ExportPreset>) => void }): JSX.Element {
  return (
    <div className="custom-preset-panel">
      <PanelTitle icon={<SlidersHorizontal />} title="自定义导出" />
      <div className="number-grid">
        <NumberField label="宽度" value={preset.width} onChange={(value) => onChange({ width: Math.max(240, Math.round(value)) })} />
        <NumberField label="高度" value={preset.height} onChange={(value) => onChange({ height: Math.max(240, Math.round(value)) })} />
        <NumberField label="帧率" value={preset.fps} onChange={(value) => onChange({ fps: Math.max(12, Math.min(120, Math.round(value))) })} />
        <NumberField label="封面帧" value={preset.coverFrame} onChange={(value) => onChange({ coverFrame: Math.max(0, Math.round(value)) })} />
      </div>
      <div className="number-grid">
        <label className="field compact">
          <span>视频码率</span>
          <input value={preset.videoBitrate} onChange={(event) => onChange({ videoBitrate: event.target.value })} />
        </label>
        <label className="field compact">
          <span>音频码率</span>
          <input value={preset.audioBitrate} onChange={(event) => onChange({ audioBitrate: event.target.value })} />
        </label>
      </div>
      <div className="preset-chips">
        <button onClick={() => onChange({ width: 1080, height: 1920 })}>9:16</button>
        <button onClick={() => onChange({ width: 1920, height: 1080 })}>16:9</button>
        <button onClick={() => onChange({ width: 1080, height: 1080 })}>1:1</button>
        <button onClick={() => onChange({ width: 1440, height: 1080 })}>4:3</button>
      </div>
    </div>
  )
}

function IconButton({ title, icon, onClick }: { title: string; icon: JSX.Element; onClick: () => void | Promise<void> }): JSX.Element {
  return (
    <button type="button" className="icon-button" title={title} onClick={() => void onClick()}>
      {icon}
    </button>
  )
}

function previewStageStyle(width: number, height: number): CSSProperties {
  const safeWidth = Math.max(1, Math.round(width || 1080))
  const safeHeight = Math.max(1, Math.round(height || 1920))
  const isLandscape = safeWidth >= safeHeight
  return {
    aspectRatio: `${safeWidth} / ${safeHeight}`,
    ...(isLandscape ? { width: 'min(100%, 680px)', height: 'auto' } : { width: 'auto', height: 'min(100%, 560px)' })
  }
}

function previewLayerStyle(
  item: TimelineItem,
  asset: Asset,
  transform: ReturnType<typeof normalizeTransform>,
  presetWidth: number,
  presetHeight: number,
  mediaSize: { width: number; height: number }
): CSSProperties {
  const base: CSSProperties = {
    left: `${50 + (transform.x / presetWidth) * 100}%`,
    top: `${50 + (transform.y / presetHeight) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.flipX ? -1 : 1}, ${transform.flipY ? -1 : 1})`,
    opacity: transform.opacity
  }

  if (isBackgroundVisualLayer(item, asset)) {
    return {
      ...base,
      width: `${transform.scale * 100}%`,
      height: `${transform.scale * 100}%`
    }
  }

  return {
    ...base,
    width: `${transform.scale * 100}%`,
    aspectRatio: `${mediaSize.width} / ${mediaSize.height}`
  }
}

function visibleBoundsStyle(bounds: VisibleBounds): CSSProperties {
  const left = clampNumber(bounds.left, 0, 1)
  const top = clampNumber(bounds.top, 0, 1)
  const width = clampNumber(bounds.width, 0.02, 1)
  const height = clampNumber(bounds.height, 0.02, 1)
  return {
    left: `${left * 100}%`,
    top: `${top * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`
  }
}

function isBackgroundVisualLayer(item: TimelineItem, asset: Asset): boolean {
  return item.trackId === 'visual-main' || isBackgroundAsset(asset)
}

function mediaAspectRatio(asset: Asset): number {
  if (asset.width && asset.height && asset.width > 0 && asset.height > 0) {
    return clampNumber(asset.width / asset.height, 0.18, 5)
  }
  if (isGreenScreenAsset(asset)) return 0.56
  if (asset.type === 'video') return 16 / 9
  return 1
}

function mediaCanvasSize(asset: Asset): { width: number; height: number } {
  const aspect = mediaAspectRatio(asset)
  const width = asset.width || (asset.type === 'video' ? 960 : 512)
  return { width, height: Math.max(1, Math.round(width / aspect)) }
}

function mediaElementSize(media: HTMLVideoElement | HTMLImageElement): { width: number; height: number } {
  const width = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth
  const height = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight
  if (!width || !height) return { width: 960, height: 540 }
  return { width, height }
}

function mediaPlaybackSeconds(item: TimelineItem, asset: Asset, localFrame: number, fps: number): number {
  const sourceFrame = Math.max(0, localFrame + item.sourceInFrame)
  const rawSeconds = sourceFrame / fps
  if (!item.loop || !asset.duration || asset.duration <= 0.05) return rawSeconds
  return rawSeconds % asset.duration
}

function PanelTitle({ icon, title }: { icon: JSX.Element; title: string }): JSX.Element {
  return (
    <div className="panel-title">
      {icon}
      <strong>{title}</strong>
    </div>
  )
}

function TabButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: JSX.Element; onClick: () => void }): JSX.Element {
  return (
    <button className={active ? 'tab active' : 'tab'} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function providerName(provider: AssetProvider): string {
  const names: Record<AssetProvider, string> = {
    local: '本地',
    pexels: 'Pexels',
    pixabay: 'Pixabay',
    openverse: 'Openverse',
    wikimedia: 'Wikimedia',
    imgflip: 'Imgflip',
    giphy: 'GIPHY',
    knowyourmeme: 'KYM',
    ai: 'AI'
  }
  return names[provider]
}

function normalizeCustomPreset(preset?: ExportPreset): ExportPreset {
  return {
    id: 'custom',
    name: '自定义分辨率',
    platform: 'custom',
    width: Math.max(240, Math.round(preset?.width || 1080)),
    height: Math.max(240, Math.round(preset?.height || 1920)),
    fps: Math.max(12, Math.min(120, Math.round(preset?.fps || 30))),
    videoBitrate: preset?.videoBitrate || '8000k',
    audioBitrate: preset?.audioBitrate || '192k',
    coverFrame: Math.max(0, Math.round(preset?.coverFrame || 45))
  }
}

function normalizeProject(project: ProjectFile): ProjectFile {
  const tracks = normalizeProjectTracks(project.tracks || [])
  const normalizedAssets = normalizeAssets(project.assets || [])
  const assetsById = new Map(normalizedAssets.map((asset) => [asset.id, asset]))
  const roleTrackId = tracks.find((track) => track.kind === 'visual' && trackGroupId(track) === 'role')?.id
  const projectForDefaults = { ...project, tracks, assets: normalizedAssets, timeline: project.timeline || [] }
  const subtitleStyle = normalizeSubtitleStyleConfig(upgradeLegacySubtitleStyle(project.subtitleStyle))
  const fallbackRoles = createStarterRoles(tracks)
  const roles = (project.roles?.length ? project.roles : fallbackRoles).map((role, index) => ({
    ...fallbackRoles[index % fallbackRoles.length],
    ...role,
    defaultTransform: { ...roleDefaultTransform(index), ...role.defaultTransform },
    memeAssetIds: role.memeAssetIds || [],
    memeStates: role.memeStates?.length ? role.memeStates : createDefaultMemeStates(),
    memeKeywords: roleKeywords(role),
    commonLines: roleLines(role),
    speakerPosition: role.speakerPosition || 'bottom',
    subtitlePosition: role.subtitlePosition || 'top'
  }))
  const timeline = project.timeline.map((item) => {
    const normalizedItem =
      item.type === 'subtitle'
        ? {
            ...item,
            speakerPosition: item.speakerPosition || 'bottom',
            style: item.style ? normalizeSubtitleStyleConfig({ ...subtitleStyle, ...upgradeLegacySubtitleStyle(item.style) }) : subtitleStyle
          }
        : item
    const asset = normalizedItem.assetId ? assetsById.get(normalizedItem.assetId) : undefined
    const track = tracks.find((entry) => entry.id === normalizedItem.trackId)
    if (normalizedItem.type === 'visual' && asset && roleTrackId && trackGroupId(track) === 'background' && isCharacterLikeAsset(asset)) {
      return {
        ...normalizedItem,
        trackId: roleTrackId,
        transform: defaultTransformForAsset(projectForDefaults, asset, roleTrackId)
      }
    }
    return normalizedItem
  })
  return { ...project, tracks, assets: normalizedAssets, roles, subtitleStyle, timeline }
}

function normalizeProjectTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  return tracks
    .map((track) => ({ ...track, groupId: trackGroupId(track), locked: Boolean(track.locked), muted: Boolean(track.muted) }))
    .sort((a, b) => trackGroupOrder(trackGroupId(a)) - trackGroupOrder(trackGroupId(b)))
}

function trackGroupId(track?: Pick<TimelineTrack, 'id' | 'name' | 'kind' | 'groupId'> | null): TrackGroupId {
  if (!track) return 'role'
  if (track.groupId && TRACK_GROUP_ORDER.includes(track.groupId)) return track.groupId
  if (track.kind === 'subtitle') return 'subtitle'
  if (track.kind === 'music') return 'bgm'
  if (track.kind === 'voice' || track.kind === 'sfx') return 'sfx'
  const label = `${track.id} ${track.name}`.toLowerCase()
  if (label.includes('visual-main') || label.includes('background') || label.includes('背景')) return 'background'
  if (label.includes('visual-props') || label.includes('prop') || label.includes('effect') || label.includes('贴纸') || label.includes('特效') || label.includes('道具')) return 'effect'
  return 'role'
}

function trackGroupOrder(groupId: TrackGroupId): number {
  const index = TRACK_GROUP_ORDER.indexOf(groupId)
  return index === -1 ? TRACK_GROUP_ORDER.length : index
}

function trackGroupLabel(groupId: TrackGroupId): string {
  return TRACK_GROUPS.find((group) => group.id === groupId)?.label || groupId
}

function trackGroupDefinition(groupId: TrackGroupId): TrackGroupDefinition {
  return TRACK_GROUPS.find((group) => group.id === groupId) || TRACK_GROUPS[1]
}

function trackKindForGroup(groupId: TrackGroupId, requestedKind?: TrackKind): TrackKind {
  if (requestedKind) return requestedKind
  if (groupId === 'subtitle') return 'subtitle'
  if (groupId === 'bgm') return 'music'
  if (groupId === 'sfx') return 'sfx'
  return 'visual'
}

function canMoveTrackToGroup(track: TimelineTrack, groupId: TrackGroupId): boolean {
  const group = trackGroupDefinition(groupId)
  if (track.kind === 'visual') return group.output === 'visual'
  if (track.kind === 'subtitle') return groupId === 'subtitle'
  if (track.kind === 'music') return groupId === 'bgm'
  return groupId === 'sfx'
}

function newTrackBaseName(groupId: TrackGroupId, kind: TrackKind): string {
  if (groupId === 'background') return '背景'
  if (groupId === 'role') return '角色'
  if (groupId === 'effect') return '贴纸/特效'
  if (groupId === 'subtitle') return '字幕'
  if (groupId === 'bgm') return 'BGM'
  return kind === 'voice' ? '配音' : '音效'
}

function insertTrackInGroup(tracks: TimelineTrack[], track: TimelineTrack): TimelineTrack[] {
  return normalizeProjectTracks([...tracks, track])
}

function upgradeLegacySubtitleStyle(style?: Partial<ProjectFile['subtitleStyle']>): Partial<ProjectFile['subtitleStyle']> | undefined {
  if (!style) return style
  const outline = String(style.outlineColor || '').toLowerCase()
  const isLegacyWhiteMeme =
    style.color?.toLowerCase() === '#ffffff' &&
    !style.background &&
    ['#111827', '#111111', '#000000'].includes(outline) &&
    (style.fontSize === 58 || style.fontSize === 72) &&
    (style.outlineWidth === 5 || style.outlineWidth === undefined) &&
    (style.position === 'bottom' || style.position === undefined)

  return isLegacyWhiteMeme ? SUBTITLE_STYLE_PRESETS[0].style : style
}

function normalizeAssets(input: Asset[]): Asset[] {
  const expanded = input.flatMap((asset) => {
    const wrapped = asset as Asset & { value?: Asset[] }
    return Array.isArray(wrapped.value) ? wrapped.value : [asset]
  })
  const normalized = expanded
    .map((asset) => normalizeAsset(asset))
    .filter((asset): asset is Asset => Boolean(asset))
  return [...new Map(normalized.map((asset) => [asset.id, asset])).values()]
}

function normalizeAsset(asset: Asset | undefined | null): Asset | null {
  if (!asset || !asset.localPath || !asset.filename || !asset.type) return null
  return {
    ...asset,
    id: asset.id || `${asset.provider || 'local'}-${asset.filename}`,
    tags: assetTags(asset),
    provider: asset.provider || 'local',
    license: asset.license || '本地素材',
    riskLevel: asset.riskLevel || 'medium',
    title: asset.title || asset.filename,
    createdAt: asset.createdAt || new Date().toISOString()
  }
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

function assetTags(asset: Partial<Asset>): string[] {
  return safeStringArray(asset.tags)
}

function roleKeywords(role: Partial<CharacterRole>): string[] {
  const keywords = safeStringArray(role.memeKeywords)
  return keywords.length ? keywords : STARTER_ROLE_KEYWORDS
}

function roleLines(role: Partial<CharacterRole>): string[] {
  const lines = safeStringArray(role.commonLines)
  return lines.length ? lines : STARTER_ROLE_LINES
}

function createStarterRoles(tracks: TimelineTrack[]): CharacterRole[] {
  const visualTracks = tracks.filter((track) => track.kind === 'visual')
  return [
    {
      id: 'role-you',
      name: '你',
      title: '渡劫期',
      color: '#facc15',
      defaultTrackId: visualTracks[1]?.id || visualTracks[0]?.id,
      defaultTransform: roleDefaultTransform(0),
      memeAssetIds: [],
      memeStates: createDefaultMemeStates(['质问', '震惊'], ['听八卦', '对话']),
      memeKeywords: ['质问', '听八卦', '震惊', '你'],
      commonLines: ['那你把你全家人都叫过来一趟', '这事儿合理吗', '我现在很冷静'],
      speakerPosition: 'bottom',
      subtitlePosition: 'top'
    },
    {
      id: 'role-banana',
      name: '香蕉猫',
      title: '练气期',
      color: '#f59e0b',
      defaultTrackId: visualTracks[2]?.id || visualTracks[0]?.id,
      defaultTransform: roleDefaultTransform(1),
      memeAssetIds: [],
      memeStates: createDefaultMemeStates(['香蕉猫', '哭泣'], ['香蕉猫', '震惊']),
      memeKeywords: ['香蕉猫', '哭泣', '大叫', '震惊'],
      commonLines: ['我真的受不了了', '为什么又是我', '先别急，让我哭完'],
      speakerPosition: 'bottom',
      subtitlePosition: 'top'
    },
    {
      id: 'role-little-sister',
      name: '小师妹',
      title: '筑基期',
      color: '#ec4899',
      defaultTrackId: visualTracks[3]?.id || visualTracks[0]?.id,
      defaultTransform: roleDefaultTransform(2),
      memeAssetIds: [],
      memeStates: createDefaultMemeStates(['委屈', '害羞'], ['可爱', '小猫']),
      memeKeywords: ['委屈', '害羞', '可爱', '小猫'],
      commonLines: ['师兄你冷静一点', '我只是路过', '完了，气氛不对'],
      speakerPosition: 'bottom',
      subtitlePosition: 'top'
    }
  ]
}

function createDefaultMemeStates(defaultKeywords = ['绿幕', '猫'], reactionKeywords = ['震惊', '大叫']): CharacterMemeState[] {
  return [
    { id: crypto.randomUUID(), name: '默认', keywords: defaultKeywords },
    { id: crypto.randomUUID(), name: '反应', keywords: reactionKeywords },
    { id: crypto.randomUUID(), name: '崩溃', keywords: ['哭', '委屈', '绝望'] }
  ]
}

function projectRoles(project: ProjectFile): CharacterRole[] {
  return project.roles?.length ? project.roles : createStarterRoles(project.tracks)
}

function roleDefaultTransform(index: number): Partial<CharacterRole['defaultTransform']> {
  if (index % 3 === 0) return { x: -280, y: 260, scale: 0.44, rotation: 0, flipX: false, flipY: false, opacity: 1 }
  if (index % 3 === 1) return { x: 260, y: 270, scale: 0.4, rotation: 0, flipX: false, flipY: false, opacity: 1 }
  return { x: 0, y: 285, scale: 0.36, rotation: 0, flipX: false, flipY: false, opacity: 1 }
}

function roleTransformPreset(preset: string, index: number): Partial<CharacterRole['defaultTransform']> {
  if (preset === 'left') return { x: -280, y: 260, scale: 0.44, rotation: 0, flipX: false, flipY: false, opacity: 1 }
  if (preset === 'right') return { x: 260, y: 270, scale: 0.4, rotation: 0, flipX: false, flipY: false, opacity: 1 }
  if (preset === 'top') return { x: 0, y: -420, scale: 0.34, rotation: 0, flipX: false, flipY: false, opacity: 1 }
  if (preset === 'center') return { x: 0, y: 285, scale: 0.36, rotation: 0, flipX: false, flipY: false, opacity: 1 }
  return roleDefaultTransform(index)
}

function rolePositionId(transform: Partial<CharacterRole['defaultTransform']>): string {
  const x = transform.x ?? 0
  const y = transform.y ?? 0
  if (y < -200) return 'top'
  if (x < -120) return 'left'
  if (x > 120) return 'right'
  return 'center'
}

function makeRoleTrack(role: CharacterRole): TimelineTrack {
  return {
    id: role.defaultTrackId || `visual-role-${role.id.slice(0, 8)}`,
    name: `角色 - ${role.name}`,
    kind: 'visual',
    groupId: 'role',
    locked: false,
    muted: false
  }
}

function insertVisualTrack(tracks: TimelineTrack[], track: TimelineTrack): TimelineTrack[] {
  if (tracks.some((item) => item.id === track.id)) return tracks
  const insertIndex = tracks.findIndex((item) => item.kind !== 'visual')
  return insertIndex > -1 ? [...tracks.slice(0, insertIndex), track, ...tracks.slice(insertIndex)] : [...tracks, track]
}

function createRoleSubtitleItem(role: CharacterRole, line: string, startFrame: number, durationFrames: number): TimelineItem {
  return {
    id: crypto.randomUUID(),
    trackId: 'subtitles',
    roleId: role.id,
    type: 'subtitle',
    label: `${role.name} 台词`,
    startFrame,
    durationFrames,
    sourceInFrame: 0,
    effects: [],
    text: line,
    speakerName: roleSpeakerLabel(role),
    speakerVisible: true,
    speakerPosition: role.speakerPosition,
    style: { position: role.subtitlePosition }
  }
}

function roleSpeakerLabel(role: CharacterRole): string {
  return role.title ? `${role.name}\n(${role.title})` : role.name
}

function lineDurationFrames(line: string, fps: number): number {
  const seconds = Math.max(1.8, Math.min(6, 1.2 + Array.from(line).length * 0.16))
  return Math.round(seconds * fps)
}

function resolveRoleAssets(role: CharacterRole, projectAssets: Asset[], localAssets: Asset[]): Asset[] {
  const map = new Map([...projectAssets, ...localAssets].map((asset) => [asset.id, asset]))
  return safeStringArray(role.memeAssetIds).map((id) => map.get(id)).filter((asset): asset is Asset => Boolean(asset))
}

function roleMemeStates(role: CharacterRole): CharacterMemeState[] {
  const states = role.memeStates?.length ? role.memeStates : createDefaultMemeStates()
  return states.map((state) => ({
    ...state,
    keywords: safeStringArray(state.keywords)
  }))
}

function recommendAssetsForStates(role: CharacterRole, localAssets: Asset[], projectAssets: Asset[]): Asset[] {
  const stateKeywords = roleMemeStates(role).flatMap((state) => state.keywords)
  const pseudoRole = { ...role, memeKeywords: uniqueStrings([...roleKeywords(role), ...stateKeywords]) }
  const recommended = recommendAssetsForRole(pseudoRole, localAssets, projectAssets)
  const selected = resolveRoleAssets(role, projectAssets, localAssets)
  return [...new Map([...selected, ...recommended].map((asset) => [asset.id, asset])).values()].slice(0, 80)
}

function recommendAssetsForRole(role: CharacterRole, localAssets: Asset[], projectAssets: Asset[]): Asset[] {
  const assets = [...new Map([...localAssets, ...projectAssets].filter(isVisualAsset).map((asset) => [asset.id, asset])).values()]
  const scored = assets
    .map((asset) => ({ asset, score: roleAssetScore(role, asset) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (a.asset.title || a.asset.filename).localeCompare(b.asset.title || b.asset.filename, 'zh-CN'))
    .map((item) => item.asset)

  if (scored.length) return scored
  return assets.filter(isGreenScreenAsset).slice(0, 24)
}

function roleAssetScore(role: CharacterRole, asset: Asset): number {
  const haystack = assetSearchText(asset)
  const tokens = uniqueStrings([role.name, role.title, ...roleKeywords(role)]).filter((token) => token.length > 0)
  let score = safeStringArray(role.memeAssetIds).includes(asset.id) ? 20 : 0
  tokens.forEach((token) => {
    if (haystack.includes(token.toLowerCase())) score += token.length >= 3 ? 6 : 3
  })
  if (isGreenScreenAsset(asset)) score += 2
  if (assetTags(asset).includes('有声')) score += 1
  return score
}

function assetSearchText(asset: Asset): string {
  return `${asset.title || ''} ${asset.filename} ${assetTags(asset).join(' ')}`.toLowerCase()
}

function textToLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function textToTokens(value: string): string[] {
  return uniqueStrings(
    value
      .split(/[\s,，、/]+/)
      .map((token) => token.trim())
      .filter(Boolean)
  )
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))]
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function isVisualAsset(asset: Asset): boolean {
  return ['image', 'video', 'gif'].includes(asset.type)
}

function filterLocalAssets(assets: Asset[], filter: LocalAssetFilter): Asset[] {
  const tokens = textToTokens(filter.query.toLowerCase())
  const subcategory = ASSET_SUBCATEGORIES[filter.primaryCategory]?.find((item) => item.id === filter.subCategory)

  return assets
    .filter((asset) => {
      const haystack = assetSearchText(asset)
      const matchesQuery = tokens.every((token) => haystack.includes(token))
      const matchesType = filter.typeFilter === 'all' || asset.type === filter.typeFilter
      const matchesPrimary = assetMatchesPrimaryCategory(asset, filter.primaryCategory)
      const matchesSubcategory = assetMatchesSubcategory(asset, subcategory)
      return matchesQuery && matchesType && matchesPrimary && matchesSubcategory
    })
    .sort((a, b) => compareAssets(a, b, filter.sortMode))
}

function assetMatchesSubcategory(asset: Asset, subcategory?: AssetSubcategory): boolean {
  if (!subcategory || subcategory.id === 'all') return true
  if (subcategory.exactTags?.length) {
    const tags = assetTags(asset)
    return subcategory.exactTags.some((tag) => tags.includes(tag))
  }
  const haystack = assetSearchText(asset)
  return subcategory.tokens.some((token) => haystack.includes(token.toLowerCase()))
}

function assetMatchesPrimaryCategory(asset: Asset, category: AssetPrimaryCategory): boolean {
  if (category === 'all') return true
  const haystack = assetSearchText(asset)
  if (category === 'audio') return asset.type === 'audio' || hasNativeAudioHint(asset)
  if (category === 'green-screen') return isGreenScreenAsset(asset)
  if (category === 'background') {
    if (asset.type === 'audio') return false
    return ['background', '背景', 'scene', '场景', 'game', '游戏', 'room', '房间', 'sky', '天空', 'stage', '舞台'].some((token) => haystack.includes(token))
  }
  if (category === 'character') {
    if (asset.type === 'audio') return false
    return ['cat', '猫', '香蕉', '哭', '震惊', '生气', '开心', '跳舞', '角色', 'meme', '绿幕'].some((token) => haystack.includes(token))
  }
  if (category === 'props') return ['道具', '特效', 'effect', 'laser', '攻击', '闪白', '反应'].some((token) => haystack.includes(token))
  if (category === 'sticker') return ['字幕', '文字', '贴纸', 'emoji', 'caption', '标题', '弹幕'].some((token) => haystack.includes(token))
  return true
}

function compareAssets(a: Asset, b: Asset, sortMode: AssetSortMode): number {
  if (sortMode === 'name') return (a.title || a.filename).localeCompare(b.title || b.filename, 'zh-CN')
  if (sortMode === 'duration') return (b.duration || 0) - (a.duration || 0) || (a.title || a.filename).localeCompare(b.title || b.filename, 'zh-CN')
  if (sortMode === 'type') return a.type.localeCompare(b.type) || (a.title || a.filename).localeCompare(b.title || b.filename, 'zh-CN')
  if (sortMode === 'usage') return assetUsageScore(b) - assetUsageScore(a) || (a.title || a.filename).localeCompare(b.title || b.filename, 'zh-CN')
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
}

function assetUsageScore(asset: Asset): number {
  let score = 0
  if (isGreenScreenAsset(asset)) score += 20
  if (hasNativeAudioHint(asset)) score += 12
  if (asset.type === 'video') score += 8
  if (asset.type === 'audio') score += 6
  score += Math.min(10, assetTags(asset).length)
  return score
}

function countAssetsForCategory(assets: Asset[], category: AssetPrimaryCategory): number {
  return assets.filter((asset) => assetMatchesPrimaryCategory(asset, category)).length
}

function assetBadges(asset: Asset): string[] {
  const badges = [assetTypeName(asset.type)]
  if (isGreenScreenAsset(asset)) badges.push('绿幕')
  if (hasNativeAudioHint(asset)) badges.push('有声')
  if (asset.duration) badges.push(formatDurationSeconds(asset.duration))
  if (asset.width && asset.height) badges.push(`${asset.width}x${asset.height}`)
  assetTags(asset).slice(0, 2).forEach((tag) => {
    if (!badges.includes(tag)) badges.push(tag)
  })
  return badges.slice(0, 5)
}

function assetTypeName(type: Asset['type']): string {
  if (type === 'image') return '图片'
  if (type === 'video') return '视频'
  if (type === 'audio') return '音频'
  if (type === 'gif') return 'GIF'
  return '字体'
}

function formatAssetInfo(asset: Asset): string {
  const parts = [assetTypeName(asset.type)]
  if (asset.duration) parts.push(formatDurationSeconds(asset.duration))
  if (asset.width && asset.height) parts.push(`${asset.width}x${asset.height}`)
  return parts.join(' · ')
}

function formatDurationSeconds(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))
  const minute = Math.floor(value / 60)
  const second = value % 60
  return minute ? `${minute}:${String(second).padStart(2, '0')}` : `${second}s`
}

function riskName(risk: string): string {
  if (risk === 'safe') return '低风险'
  if (risk === 'medium') return '需核验'
  return '热梗风险'
}

function effectName(effect: string): string {
  const names: Record<string, string> = {
    none: '无',
    'zoom-in': '推近',
    'zoom-out': '拉远',
    'pan-left': '左移',
    'pan-right': '右移',
    shake: '抖动',
    flash: '闪白'
  }
  return names[effect] || effect
}

function trackIdForKind(project: ProjectFile, kind: TrackKind, selectedItem: TimelineItem | null): string {
  if (kind === 'visual') {
    if (selectedItem?.type === 'visual') return selectedItem.trackId
    return trackByGroupKind(project, 'role', 'visual')?.id || project.tracks.find((track) => track.kind === 'visual')?.id || 'visual-main'
  }
  if (kind === 'subtitle') return trackByGroupKind(project, 'subtitle', 'subtitle')?.id || 'subtitles'
  if (kind === 'voice') return trackByGroupKind(project, 'sfx', 'voice')?.id || trackByGroupKind(project, 'sfx', 'sfx')?.id || 'voice'
  if (kind === 'music') return trackByGroupKind(project, 'bgm', 'music')?.id || 'music'
  if (kind === 'sfx') return trackByGroupKind(project, 'sfx', 'sfx')?.id || trackByGroupKind(project, 'sfx', 'voice')?.id || 'sfx'
  return 'visual-main'
}

function trackIdForVisualAsset(project: ProjectFile, asset: Asset, selectedItem: TimelineItem | null): string {
  const bottomTrackId = backgroundTrackId(project)
  if (isBackgroundAsset(asset)) return bottomTrackId
  if (selectedItem?.type === 'visual' && selectedItem.trackId !== bottomTrackId) return selectedItem.trackId
  const targetGroup = visualTargetGroupForAsset(asset)
  return trackByGroupKind(project, targetGroup, 'visual')?.id || project.tracks.find((track) => track.kind === 'visual' && track.id !== bottomTrackId)?.id || project.tracks.find((track) => track.kind === 'visual')?.id || 'visual-main'
}

function backgroundTrackId(project: ProjectFile): string {
  return trackByGroupKind(project, 'background', 'visual')?.id || project.tracks.find((track) => track.id === 'visual-main' && track.kind === 'visual')?.id || project.tracks.find((track) => track.kind === 'visual')?.id || 'visual-main'
}

function trackByGroupKind(project: ProjectFile, groupId: TrackGroupId, kind: TrackKind): TimelineTrack | undefined {
  return project.tracks.find((track) => trackGroupId(track) === groupId && track.kind === kind && !track.locked) || project.tracks.find((track) => trackGroupId(track) === groupId && track.kind === kind)
}

function isBackgroundAsset(asset: Asset): boolean {
  return isVisualAsset(asset) && assetMatchesPrimaryCategory(asset, 'background')
}

function isCharacterLikeAsset(asset: Asset): boolean {
  return isVisualAsset(asset) && !isBackgroundAsset(asset) && (isGreenScreenAsset(asset) || assetMatchesPrimaryCategory(asset, 'character'))
}

function visualTargetGroupForAsset(asset: Asset): Extract<TrackGroupId, 'background' | 'role' | 'effect'> {
  if (isBackgroundAsset(asset)) return 'background'
  if (assetMatchesPrimaryCategory(asset, 'props') || assetMatchesPrimaryCategory(asset, 'sticker')) return 'effect'
  return 'role'
}

function nextStartFrame(project: ProjectFile, trackId: string): number {
  return project.timeline
    .filter((item) => item.trackId === trackId)
    .reduce((max, item) => Math.max(max, item.startFrame + item.durationFrames), 0)
}

function defaultTransformForAsset(project: ProjectFile, asset: Asset, trackId: string, preset?: ExportPreset): ReturnType<typeof normalizeTransform> {
  const track = project.tracks.find((entry) => entry.id === trackId)
  const groupId = trackGroupId(track)
  if (isBackgroundAsset(asset) || groupId === 'background') return { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 }
  return {
    ...defaultTransformForTrack(project, trackId),
    scale: defaultScaleForAsset(asset, groupId, preset)
  }
}

function defaultTransformForTrack(project: ProjectFile, trackId: string): ReturnType<typeof normalizeTransform> {
  const track = project.tracks.find((entry) => entry.id === trackId)
  const groupId = trackGroupId(track)
  if (groupId === 'background') return { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 }
  if (groupId === 'effect') return { x: 0, y: -60, scale: 0.26, rotation: 0, flipX: false, flipY: false, opacity: 1 }

  const roleTracks = project.tracks.filter((entry) => entry.kind === 'visual' && trackGroupId(entry) === 'role')
  const roleIndex = Math.max(0, roleTracks.findIndex((entry) => entry.id === trackId))
  const offset = roleIndex % 3 === 0 ? -220 : roleIndex % 3 === 1 ? 220 : 0
  const y = roleIndex % 3 === 2 ? 120 : 220
  return { x: offset, y, scale: 0.34, rotation: 0, flipX: false, flipY: false, opacity: 1 }
}

function defaultScaleForAsset(asset: Asset, groupId: TrackGroupId, preset?: ExportPreset): number {
  const canvasWidth = preset?.width || 1080
  const canvasHeight = preset?.height || 1920
  const canvasHeightOverWidth = canvasHeight / Math.max(1, canvasWidth)
  const isLandscape = canvasWidth > canvasHeight
  const aspect = mediaAspectRatio(asset)

  if (groupId === 'effect') {
    const targetHeight = isLandscape ? 0.24 : 0.18
    return clampNumber(targetHeight * aspect * canvasHeightOverWidth, 0.12, isLandscape ? 0.32 : 0.34)
  }

  const targetHeight = isGreenScreenAsset(asset) ? (isLandscape ? 0.58 : 0.52) : (isLandscape ? 0.48 : 0.38)
  return clampNumber(targetHeight * aspect * canvasHeightOverWidth, isLandscape ? 0.12 : 0.18, isLandscape ? 0.42 : 0.68)
}

function splitVisualKeyframesAtFrame(item: TimelineItem, localFrame: number): { first?: VisualKeyframe[]; second?: VisualKeyframe[] } {
  if (item.type !== 'visual' || !item.keyframes?.length) return { first: item.keyframes, second: item.keyframes }
  const cutFrame = clampNumber(Math.round(localFrame), 1, Math.max(1, item.durationFrames - 1))
  const keyframes = visualKeyframes(item)
  const first = keyframes
    .filter((keyframe) => keyframe.frame < cutFrame)
    .map((keyframe) => ({ ...keyframe, id: keyframe.id || crypto.randomUUID() }))
  const cutTransform = visualTransformAtFrame(item, cutFrame)
  const second = [
    { id: crypto.randomUUID(), frame: 0, ...cutTransform },
    ...keyframes
      .filter((keyframe) => keyframe.frame > cutFrame)
      .map((keyframe) => ({ ...keyframe, id: crypto.randomUUID(), frame: keyframe.frame - cutFrame }))
  ]
  return {
    first: first.length ? first : undefined,
    second: second.length ? second : undefined
  }
}

function normalizeTransform(transform?: TimelineItem['transform']): { x: number; y: number; scale: number; rotation: number; flipX: boolean; flipY: boolean; opacity: number } {
  return {
    x: transform?.x ?? 0,
    y: transform?.y ?? 0,
    scale: Math.max(0.08, Math.min(4, transform?.scale ?? 1)),
    rotation: transform?.rotation ?? 0,
    flipX: transform?.flipX ?? false,
    flipY: transform?.flipY ?? false,
    opacity: Math.max(0, Math.min(1, transform?.opacity ?? 1))
  }
}

function localFrameForItem(item: TimelineItem, playheadFrame: number): number {
  return clampNumber(playheadFrame - item.startFrame, 0, Math.max(0, item.durationFrames - 1))
}

function normalizeKeyframe(frame: Partial<VisualKeyframe>, fallback: NormalizedTransform, maxFrame: number): VisualKeyframe {
  return {
    id: frame.id || crypto.randomUUID(),
    frame: clampNumber(Math.round(frame.frame ?? 0), 0, maxFrame),
    x: Number.isFinite(frame.x) ? Number(frame.x) : fallback.x,
    y: Number.isFinite(frame.y) ? Number(frame.y) : fallback.y,
    scale: clampNumber(frame.scale ?? fallback.scale, 0.08, 4),
    rotation: Number.isFinite(frame.rotation) ? Number(frame.rotation) : fallback.rotation,
    opacity: clampNumber(frame.opacity ?? fallback.opacity, 0, 1)
  }
}

function visualKeyframes(item: TimelineItem): VisualKeyframe[] {
  const base = normalizeTransform(item.transform)
  const maxFrame = Math.max(0, item.durationFrames - 1)
  const byFrame = new Map<number, VisualKeyframe>()
  ;(item.keyframes || []).forEach((keyframe) => {
    const normalized = normalizeKeyframe(keyframe, base, maxFrame)
    byFrame.set(normalized.frame, normalized)
  })
  return [...byFrame.values()].sort((a, b) => a.frame - b.frame)
}

function visualTransformAtFrame(item: TimelineItem, localFrame: number): NormalizedTransform {
  const base = normalizeTransform(item.transform)
  const keyframes = visualKeyframes(item)
  if (!keyframes.length) return base

  const frame = clampNumber(Math.round(localFrame), 0, Math.max(0, item.durationFrames - 1))
  const first = keyframes[0]
  if (frame <= first.frame) {
    if (first.frame > 0) {
      const ratio = frame / first.frame
      return {
        ...base,
        x: lerp(base.x, first.x, ratio),
        y: lerp(base.y, first.y, ratio),
        scale: lerp(base.scale, first.scale, ratio),
        rotation: lerp(base.rotation, first.rotation, ratio),
        opacity: lerp(base.opacity, first.opacity, ratio)
      }
    }
    return { ...base, x: first.x, y: first.y, scale: first.scale, rotation: first.rotation, opacity: first.opacity }
  }

  const last = keyframes[keyframes.length - 1]
  if (frame >= last.frame) {
    return { ...base, x: last.x, y: last.y, scale: last.scale, rotation: last.rotation, opacity: last.opacity }
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const from = keyframes[index]
    const to = keyframes[index + 1]
    if (frame < from.frame || frame > to.frame) continue
    const ratio = (frame - from.frame) / Math.max(1, to.frame - from.frame)
    return {
      ...base,
      x: lerp(from.x, to.x, ratio),
      y: lerp(from.y, to.y, ratio),
      scale: lerp(from.scale, to.scale, ratio),
      rotation: lerp(from.rotation, to.rotation, ratio),
      opacity: lerp(from.opacity, to.opacity, ratio)
    }
  }

  return base
}

function keyframeAtLocalFrame(item: TimelineItem, localFrame: number): VisualKeyframe | undefined {
  const frame = clampNumber(Math.round(localFrame), 0, Math.max(0, item.durationFrames - 1))
  return visualKeyframes(item).find((keyframe) => keyframe.frame === frame)
}

function patchVisualTransformAtFrame(item: TimelineItem, localFrame: number, patch: Partial<VisualTransform>): Partial<TimelineItem> {
  const frame = clampNumber(Math.round(localFrame), 0, Math.max(0, item.durationFrames - 1))
  const keyframes = visualKeyframes(item)
  const existing = keyframes.find((keyframe) => keyframe.frame === frame)
  const flipPatch =
    'flipX' in patch || 'flipY' in patch
      ? { transform: { ...normalizeTransform(item.transform), flipX: patch.flipX ?? normalizeTransform(item.transform).flipX, flipY: patch.flipY ?? normalizeTransform(item.transform).flipY } }
      : {}
  if (!existing) {
    const base = normalizeTransform(item.transform)
    return { transform: { ...base, ...patch } }
  }
  return {
    ...flipPatch,
    keyframes: keyframes.map((keyframe) =>
      keyframe.frame === frame
        ? normalizeKeyframe({ ...keyframe, ...patch, frame, id: keyframe.id }, normalizeTransform(item.transform), Math.max(0, item.durationFrames - 1))
        : keyframe
    )
  }
}

function upsertVisualKeyframe(item: TimelineItem, localFrame: number, transform = visualTransformAtFrame(item, localFrame)): VisualKeyframe[] {
  const frame = clampNumber(Math.round(localFrame), 0, Math.max(0, item.durationFrames - 1))
  const keyframes = visualKeyframes(item).filter((keyframe) => keyframe.frame !== frame)
  keyframes.push({
    id: keyframeAtLocalFrame(item, frame)?.id || crypto.randomUUID(),
    frame,
    x: Math.round(transform.x),
    y: Math.round(transform.y),
    scale: Number(transform.scale.toFixed(3)),
    rotation: Math.round(transform.rotation),
    opacity: Number(transform.opacity.toFixed(3))
  })
  return keyframes.sort((a, b) => a.frame - b.frame)
}

function removeVisualKeyframe(item: TimelineItem, localFrame: number): VisualKeyframe[] {
  const frame = clampNumber(Math.round(localFrame), 0, Math.max(0, item.durationFrames - 1))
  return visualKeyframes(item).filter((keyframe) => keyframe.frame !== frame)
}

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * clampNumber(ratio, 0, 1)
}

function normalizeKeying(keying?: TimelineItem['keying']): { enabled: boolean; color: string; similarity: number; blend: number } {
  return {
    enabled: keying?.enabled ?? false,
    color: /^#[0-9a-f]{6}$/i.test(keying?.color || '') ? keying?.color || '#00ff00' : '#00ff00',
    similarity: Math.max(0.01, Math.min(1, keying?.similarity ?? 0.22)),
    blend: Math.max(0, Math.min(1, keying?.blend ?? 0.08))
  }
}

function normalizeSubtitleStyle(
  base: ProjectFile['subtitleStyle'],
  override?: TimelineItem['style']
): ProjectFile['subtitleStyle'] {
  return normalizeSubtitleStyleConfig({ ...base, ...override })
}

function normalizeSubtitleStyleConfig(style?: Partial<ProjectFile['subtitleStyle']>): ProjectFile['subtitleStyle'] {
  const fallback = SUBTITLE_STYLE_PRESETS[0].style
  return {
    fontFamily: style?.fontFamily || fallback.fontFamily,
    fontSize: Math.max(12, Math.round(style?.fontSize || fallback.fontSize)),
    color: /^#[0-9a-f]{6}$/i.test(style?.color || '') ? style?.color || fallback.color : fallback.color,
    outlineColor: /^#[0-9a-f]{6}$/i.test(style?.outlineColor || '') ? style?.outlineColor || fallback.outlineColor : fallback.outlineColor,
    outlineWidth: Math.max(0, Math.round(style?.outlineWidth ?? fallback.outlineWidth)),
    position: style?.position || fallback.position,
    background: style?.background ?? fallback.background,
    backgroundColor: /^#[0-9a-f]{6}$/i.test(style?.backgroundColor || '') ? style?.backgroundColor || fallback.backgroundColor : fallback.backgroundColor
  }
}

function previewSubtitleCss(style: ProjectFile['subtitleStyle']): CSSProperties {
  const outline = style.outlineColor
  return {
    fontFamily: style.fontFamily,
    color: style.color,
    fontSize: `${Math.max(14, Math.round(style.fontSize * 0.34))}px`,
    background: style.background ? style.backgroundColor : 'transparent',
    boxShadow: style.background ? `0 0 0 1px ${style.outlineColor}` : 'none',
    textShadow: [
      `1px 0 0 ${outline}`,
      `-1px 0 0 ${outline}`,
      `0 1px 0 ${outline}`,
      `0 -1px 0 ${outline}`,
      `1px 1px 0 ${outline}`
    ].join(', ')
  }
}

function isGreenScreenAsset(asset: Asset): boolean {
  const haystack = `${asset.filename} ${asset.title || ''} ${assetTags(asset).join(' ')}`.toLowerCase()
  return haystack.includes('绿幕') || haystack.includes('green') || haystack.includes('chroma')
}

function greenAlphaVariant(asset: Asset): NonNullable<Asset['processedVariants']>[number] | undefined {
  return asset.processedVariants?.find((variant) => variant.kind === 'green-alpha' && Boolean(variant.fileUrl || variant.localPath))
}

function mediaReady(media: HTMLVideoElement | HTMLImageElement): boolean {
  if (media instanceof HTMLVideoElement) return media.readyState >= 2 && media.videoWidth > 0 && media.videoHeight > 0
  return media.complete && media.naturalWidth > 0 && media.naturalHeight > 0
}

function drawKeyedFrame(
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | HTMLImageElement,
  keying: ReturnType<typeof normalizeKeying>
): VisibleBounds | null {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const sourceWidth = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth
  const sourceHeight = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight
  if (!sourceWidth || !sourceHeight) return null

  context.clearRect(0, 0, canvas.width, canvas.height)
  const scale = Math.max(canvas.width / sourceWidth, canvas.height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const x = (canvas.width - drawWidth) / 2
  const y = (canvas.height - drawHeight) / 2
  context.drawImage(media, x, y, drawWidth, drawHeight)

  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  const [keyR, keyG, keyB] = hexToRgb(keying.color)
  const hard = keying.similarity
  const soft = Math.max(0.001, keying.blend)
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1

  for (let index = 0; index < data.length; index += 4) {
    const dr = data[index] - keyR
    const dg = data[index + 1] - keyG
    const db = data[index + 2] - keyB
    const distance = Math.sqrt(dr * dr + dg * dg + db * db) / 441.67295593
    if (distance < hard) {
      data[index + 3] = 0
    } else if (distance < hard + soft) {
      data[index + 3] = Math.round(255 * ((distance - hard) / soft))
    }
    if (data[index + 3] > 12) {
      const pixel = index / 4
      const px = pixel % canvas.width
      const py = Math.floor(pixel / canvas.width)
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px > maxX) maxX = px
      if (py > maxY) maxY = py
    }
  }
  context.putImageData(image, 0, 0)
  if (maxX < minX || maxY < minY) return null
  return {
    left: minX / canvas.width,
    top: minY / canvas.height,
    width: (maxX - minX + 1) / canvas.width,
    height: (maxY - minY + 1) / canvas.height
  }
}

function isUsefulForegroundBounds(bounds: VisibleBounds): boolean {
  return bounds.width >= 0.08 && bounds.height >= 0.08 && bounds.width * bounds.height >= 0.012
}

function detectFirstVisibleFrame(asset: Asset, fps: number, keying?: TimelineItem['keying']): Promise<number> {
  if (!asset.fileUrl || !['video', 'gif'].includes(asset.type)) return Promise.resolve(0)
  const normalizedKeying = normalizeKeying(keying)
  const cacheKey = `${asset.fileUrl}|${fps}|${normalizedKeying.color}|${normalizedKeying.similarity}|${normalizedKeying.blend}`
  const cached = firstVisibleFrameCache.get(cacheKey)
  if (cached) return cached

  const promise = new Promise<number>((resolve) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = asset.fileUrl || ''
    canvas.width = 128
    canvas.height = 128

    let settled = false
    let metadataReady = false
    let sampleIndex = 0
    let samples: number[] = [0]
    const timeout = window.setTimeout(() => finish(0), 3500)

    function finish(frame: number): void {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      video.src = ''
      resolve(Math.max(0, frame))
    }

    function buildSamples(): void {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 2
      const maxSeconds = Math.min(duration, 2.2)
      const step = Math.max(1 / fps, 0.066)
      samples = []
      for (let time = 0; time <= maxSeconds + 0.001; time += step) {
        samples.push(Number(time.toFixed(3)))
      }
      if (!samples.includes(0)) samples.unshift(0)
    }

    function seekNext(): void {
      if (settled) return
      if (sampleIndex >= samples.length) {
        finish(0)
        return
      }
      const time = samples[sampleIndex]
      sampleIndex += 1
      try {
        if (Math.abs(video.currentTime - time) < 0.01 && mediaReady(video)) {
          inspectFrame()
        } else {
          video.currentTime = time
        }
      } catch {
        finish(0)
      }
    }

    function inspectFrame(): void {
      if (settled || !mediaReady(video)) {
        seekNext()
        return
      }
      const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 1
      canvas.width = 128
      canvas.height = Math.max(32, Math.round(128 / clampNumber(aspect, 0.2, 5)))
      const bounds = drawKeyedFrame(canvas, video, normalizedKeying)
      if (bounds && isUsefulForegroundBounds(bounds)) {
        finish(Math.max(0, Math.round(video.currentTime * fps)))
      } else {
        seekNext()
      }
    }

    video.onloadedmetadata = () => {
      metadataReady = true
      buildSamples()
      seekNext()
    }
    video.onseeked = inspectFrame
    video.onloadeddata = () => {
      if (metadataReady && video.currentTime === 0) inspectFrame()
    }
    video.onerror = () => finish(0)
  }).catch(() => 0)

  firstVisibleFrameCache.set(cacheKey, promise)
  return promise
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2) || '00', 16),
    Number.parseInt(clean.slice(2, 4) || 'ff', 16),
    Number.parseInt(clean.slice(4, 6) || '00', 16)
  ]
}

function findActiveVisualItems(project: ProjectFile | null, frame: number, soloGroup?: TrackGroupId | null): TimelineItem[] {
  if (!project) return []
  const trackOrder = new Map(project.tracks.map((track, index) => [track.id, index]))
  const timelineOrder = new Map(project.timeline.map((item, index) => [item.id, index]))
  const visibleTracks = new Set(project.tracks.filter((track) => !track.muted && (!soloGroup || trackGroupId(track) === soloGroup)).map((track) => track.id))
  return project.timeline
    .filter((item) => item.type === 'visual' && visibleTracks.has(item.trackId) && frame >= item.startFrame && frame < item.startFrame + item.durationFrames)
    .sort((a, b) => (trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0) || (timelineOrder.get(a.id) ?? 0) - (timelineOrder.get(b.id) ?? 0))
}

function findPreviewAudioItems(project: ProjectFile | null, frame: number, soloGroup?: TrackGroupId | null): TimelineItem[] {
  if (!project) return []
  const assets = new Map(project.assets.map((asset) => [asset.id, asset]))
  const audibleTracks = new Set(project.tracks.filter((track) => !track.muted && (!soloGroup || trackGroupId(track) === soloGroup)).map((track) => track.id))
  return project.timeline.filter((item) => {
    if (!audibleTracks.has(item.trackId)) return false
    if (!item.assetId || frame < item.startFrame || frame >= item.startFrame + item.durationFrames) return false
    if (['voice', 'music', 'sfx'].includes(item.type)) return true
    const asset = assets.get(item.assetId)
    return item.type === 'visual' && asset?.type === 'video' && (item.volume ?? 1) > 0
  })
}

function canMoveItemToTrack(project: ProjectFile, item: TimelineItem, trackId: string): boolean {
  const track = project.tracks.find((track) => track.id === trackId)
  if (!track || track.locked || track.kind !== item.type) return false
  if (item.assetId) {
    const asset = project.assets.find((asset) => asset.id === item.assetId)
    if (asset) return canDropAssetOnTimelineTrack(project, asset, track)
  }
  return true
}

function canDropAssetOnTimelineTrack(project: ProjectFile, asset: Asset, track: TimelineTrack): boolean {
  if (track.locked || !canPlaceAssetOnTrack(asset, track.kind)) return false
  if (track.kind !== 'visual') return true
  const groupId = trackGroupId(track)
  const targetGroup = visualTargetGroupForAsset(asset)
  if (targetGroup === 'background') return groupId === 'background'
  if (targetGroup === 'role') return groupId === 'role'
  if (targetGroup === 'effect') return groupId === 'effect'
  return false
}

function displayTrackName(track: TimelineTrack): string {
  const names: Record<string, string> = {
    'visual-main': '背景画面',
    'visual-role-a': '角色 1',
    'visual-role-b': '角色 2',
    'visual-props': '贴纸/特效',
    subtitles: '字幕',
    voice: '配音',
    music: 'BGM',
    sfx: '音效'
  }
  return names[track.id] || track.name
}

function trackKindLabel(kind: TrackKind): string {
  if (kind === 'visual') return 'V'
  if (kind === 'subtitle') return 'T'
  return 'A'
}

function trackKindName(kind: TrackKind): string {
  const names: Record<TrackKind, string> = {
    visual: '画面',
    subtitle: '字幕',
    voice: '配音',
    music: 'BGM',
    sfx: '音效'
  }
  return names[kind]
}

function makeRulerTicks(totalFrames: number, fps: number): Array<{ frame: number; label: string; left: number }> {
  const durationSeconds = Math.max(1, totalFrames / fps)
  const steps = [1, 2, 5, 10, 15, 30, 60, 120]
  const stepSeconds = steps.find((step) => durationSeconds / step <= 10) || 120
  const ticks: Array<{ frame: number; label: string; left: number }> = []
  for (let second = 0; second <= durationSeconds + 0.001; second += stepSeconds) {
    const frame = Math.min(totalFrames, Math.round(second * fps))
    ticks.push({ frame, label: formatSecondsLabel(second), left: (frame / totalFrames) * 100 })
  }
  if (!ticks.some((tick) => tick.frame === totalFrames)) {
    ticks.push({ frame: totalFrames, label: formatSecondsLabel(durationSeconds), left: 100 })
  }
  return ticks
}

function snapThresholdFrames(laneWidth: number, totalFrames: number, fps: number): number {
  const fromPixels = Math.round((10 / Math.max(1, laneWidth)) * totalFrames)
  return clampNumber(fromPixels, 2, Math.max(2, Math.round(fps * 0.25)))
}

function snapTimelinePatch({
  project,
  item,
  mode,
  patch,
  startFrame,
  durationFrames,
  sourceInFrame,
  trackId,
  playheadFrame,
  rulerFrames,
  thresholdFrames
}: {
  project: ProjectFile
  item: TimelineItem
  mode: 'move' | 'trim-start' | 'trim-end'
  patch: Partial<TimelineItem>
  startFrame: number
  durationFrames: number
  sourceInFrame: number
  trackId: string
  playheadFrame: number
  rulerFrames: number[]
  thresholdFrames: number
}): Partial<TimelineItem> {
  const candidates = uniqueNumbers([
    0,
    playheadFrame,
    ...rulerFrames,
    ...project.timeline
      .filter((entry) => entry.id !== item.id && entry.trackId === trackId)
      .flatMap((entry) => [entry.startFrame, entry.startFrame + entry.durationFrames])
  ])
  const nearest = (frame: number): number | null => {
    let target: number | null = null
    let distance = thresholdFrames + 1
    candidates.forEach((candidate) => {
      const nextDistance = Math.abs(candidate - frame)
      if (nextDistance <= thresholdFrames && nextDistance < distance) {
        target = candidate
        distance = nextDistance
      }
    })
    return target
  }

  if (mode === 'move') {
    const nextStart = Math.max(0, patch.startFrame ?? startFrame)
    const nextDuration = patch.durationFrames ?? durationFrames
    const snapStart = nearest(nextStart)
    const snapEnd = nearest(nextStart + nextDuration)
    if (snapStart === null && snapEnd === null) return patch
    const startDistance = snapStart === null ? Number.POSITIVE_INFINITY : Math.abs(snapStart - nextStart)
    const endDistance = snapEnd === null ? Number.POSITIVE_INFINITY : Math.abs(snapEnd - (nextStart + nextDuration))
    return {
      ...patch,
      startFrame: Math.max(0, startDistance <= endDistance ? snapStart ?? nextStart : (snapEnd ?? nextStart + nextDuration) - nextDuration)
    }
  }

  if (mode === 'trim-start') {
    const nextStart = patch.startFrame ?? startFrame
    const snapStart = nearest(nextStart)
    if (snapStart === null) return patch
    const maxStart = startFrame + durationFrames - 1
    const appliedStart = clampNumber(snapStart, 0, maxStart)
    const delta = appliedStart - startFrame
    return {
      ...patch,
      startFrame: appliedStart,
      durationFrames: Math.max(1, durationFrames - delta),
      sourceInFrame: Math.max(0, sourceInFrame + delta)
    }
  }

  const nextEnd = startFrame + (patch.durationFrames ?? durationFrames)
  const snapEnd = nearest(nextEnd)
  if (snapEnd === null) return patch
  return {
    ...patch,
    durationFrames: Math.max(1, snapEnd - startFrame)
  }
}

function formatSecondsLabel(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))
  const minute = Math.floor(value / 60)
  const second = value % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

function canPlaceAssetOnTrack(asset: Asset, kind: TrackKind): boolean {
  if (kind === 'visual') return ['image', 'video', 'gif'].includes(asset.type)
  if (['voice', 'music', 'sfx'].includes(kind)) return asset.type === 'audio' || (asset.type === 'video' && hasNativeAudioHint(asset))
  return false
}

function hasNativeAudioHint(asset: Asset): boolean {
  if (asset.type === 'audio') return true
  if (asset.type !== 'video') return false
  const haystack = assetSearchText(asset)
  return ['有声', '原声', '声音', '音效', '配音', 'audio', 'sound', 'voice'].some((token) => haystack.includes(token))
}

function mergeAssets(existing: Asset[], incoming: Asset[]): Asset[] {
  const map = new Map(existing.map((asset) => [asset.id, asset]))
  incoming.forEach((asset) => map.set(asset.id, asset))
  return Array.from(map.values())
}

function scriptLines(script: string): string[] {
  return script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function findActiveItem(project: ProjectFile | null, frame: number, type: TrackKind): TimelineItem | null {
  if (!project) return null
  return (
    project.timeline
      .filter((item) => item.type === type && frame >= item.startFrame && frame < item.startFrame + item.durationFrames)
      .sort((a, b) => b.startFrame - a.startFrame)[0] || null
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

function formatTime(frame: number, fps: number): string {
  const seconds = frame / fps
  const minute = Math.floor(seconds / 60)
  const second = Math.floor(seconds % 60)
  const framePart = Math.floor(frame % fps)
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}:${String(framePart).padStart(2, '0')}`
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, '_').slice(0, 96) || 'cat-meme'
}

export default App
