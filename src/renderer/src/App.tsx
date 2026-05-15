import {
  AudioLines,
  Captions,
  Crosshair,
  FastForward,
  FilePlus2,
  Film,
  FlipHorizontal,
  FlipVertical,
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
  MousePointer2,
  Move,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Rewind,
  Rocket,
  Save,
  Scissors,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  StepBack,
  StepForward,
  Sticker,
  Trash2,
  Type,
  Unlock,
  Volume2,
  VolumeX,
  WandSparkles,
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
  RenderProgress,
  RenderResult,
  RoleStateCue,
  SubtitleBox,
  SubtitleCue,
  TimelineItem,
  TimelineTrack,
  TrackGroupId,
  TrackKind,
  VisualKeyframe,
  VisualTransform,
  WaveformData,
  WorkspaceInfo
} from '../../shared/types'
import {
  moveVisualKeyframe as moveVisualKeyframeFrame,
  normalizeVisualTransform,
  patchVisualAnimationAtFrame,
  primaryVisualEffect,
  removeVisualKeyframe as removeSharedVisualKeyframe,
  upsertVisualKeyframe as upsertSharedVisualKeyframe,
  visualAnimationStateAtFrame,
  visualKeyframes as getVisualKeyframes,
  visualTransformAtFrame as getVisualTransformAtFrame
} from '../../shared/animation'
import {
  ASSET_GRID_PAGE_SIZE,
  ASSET_LIST_PAGE_SIZE,
  ASSET_PRIMARY_CATEGORIES,
  ASSET_SORT_OPTIONS,
  ASSET_TYPE_OPTIONS,
  DEFAULT_ROLE_LABEL_STYLE,
  DEFAULT_EFFECTS,
  ROLE_COLORS,
  STARTER_ROLE_KEYWORDS,
  STARTER_ROLE_LINES,
  SUBTITLE_STYLE_PRESETS,
  TRACK_DRAG_MIME,
  TRACK_GROUP_ORDER,
  TRACK_GROUPS
} from './constants'
import type {
  AssetPrimaryCategory,
  AssetSortMode,
  AssetSubcategory,
  AssetViewMode,
  ContextInputDialog,
  EditorToolId,
  LocalAssetFilter,
  MemeActionId,
  RightTab,
  SubtitleStyleScope,
  SubtitleSyncMode,
  SubtitleTimingMode,
  TimelineContextMenu,
  TimelineLookup,
  TransformHandleId,
  TrackGroupDefinition,
  TrackGroupFilter,
  VisibleBounds
} from './types'

type TextHandleMode = TransformHandleId | 'box-left' | 'box-right' | 'box-top' | 'box-bottom'

const ASSET_SUBCATEGORIES: Record<AssetPrimaryCategory, AssetSubcategory[]> = {
  all: [{ id: 'all', label: '全部', tokens: [] }],
  favorite: [{ id: 'all', label: '全部收藏', tokens: [] }],
  'recent-used': [{ id: 'all', label: '最近用过', tokens: [] }],
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

type NormalizedTransform = ReturnType<typeof normalizeTransform>
type SelectedCueRef = { itemId: string; cueId: string; kind: 'subtitle' | 'role' }
const PROJECT_HISTORY_LIMIT = 100

interface ProjectHistoryEntry {
  before: ProjectFile
  after: ProjectFile
  label: string
  mergeKey?: string
}

interface ProjectCommitOptions {
  label?: string
  mergeKey?: string
}

interface ProjectReplaceOptions {
  resetHistory?: boolean
}

type PatchTimelineItem = (id: string, patch: Partial<TimelineItem>, options?: ProjectCommitOptions) => void

const firstVisibleFrameCache = new Map<string, Promise<number>>()
const greenThumbFrameCache = new Map<string, string>()
const MIN_PLAYBACK_RATE = 0.25
const MAX_PLAYBACK_RATE = 4

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
  const [undoStack, setUndoStack] = useState<ProjectHistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<ProjectHistoryEntry[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedCue, setSelectedCue] = useState<SelectedCueRef | null>(null)
  const [selectedKeyframe, setSelectedKeyframe] = useState<{ itemId: string; keyframeId: string } | null>(null)
  const [placementPulseItemId, setPlacementPulseItemId] = useState<string | null>(null)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [playheadFrame, setPlayheadFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerSpeed, setPlayerSpeed] = useState(1)
  const [timelineZoom, setTimelineZoom] = useState(1)
  const [timelineSnapEnabled, setTimelineSnapEnabled] = useState(true)
  const [activeTool, setActiveTool] = useState<EditorToolId>('select')
  const [activeTrackGroup, setActiveTrackGroup] = useState<TrackGroupFilter>('all')
  const [soloTrackGroup, setSoloTrackGroup] = useState<TrackGroupId | null>(null)
  const [toolDrawer, setToolDrawer] = useState<'export' | 'settings' | null>(null)
  const [contextMenu, setContextMenu] = useState<TimelineContextMenu | null>(null)
  const [contextInput, setContextInput] = useState<ContextInputDialog | null>(null)
  const contextInputRef = useRef<HTMLInputElement | null>(null)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [clipClipboard, setClipClipboard] = useState<TimelineItem | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('templates')
  const [preview, setPreview] = useState<RenderResult | null>(null)
  const [lastExport, setLastExport] = useState<RenderResult | null>(null)
  const [lastCover, setLastCover] = useState<RenderResult | null>(null)
  const [preprocessProgress, setPreprocessProgress] = useState<GreenScreenPreprocessProgress | null>(null)
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null)
  const [busy, setBusy] = useState<string | null>('启动中')
  const [notice, setNotice] = useState('正在初始化应用...')
  const [aiTopic, setAiTopic] = useState('猫猫上班第一天就想离职')
  const [quickSubtitleText, setQuickSubtitleText] = useState('')
  const [quickSubtitleSeconds, setQuickSubtitleSeconds] = useState(2.8)
  const quickSubtitleInputRef = useRef<HTMLInputElement | null>(null)
  const projectRef = useRef<ProjectFile | null>(null)
  const undoStackRef = useRef<ProjectHistoryEntry[]>([])
  const redoStackRef = useRef<ProjectHistoryEntry[]>([])
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0
  const razorMode = activeTool === 'razor'

  useEffect(() => {
    void boot()
  }, [])

  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => {
    undoStackRef.current = undoStack
  }, [undoStack])

  useEffect(() => {
    redoStackRef.current = redoStack
  }, [redoStack])

  useEffect(() => {
    return window.catMeme.onGreenScreenPreprocessProgress((progress) => {
      setPreprocessProgress(progress)
      setNotice(`透明缓存：${progress.current}/${progress.total}，成功 ${progress.success}，跳过 ${progress.skipped}，失败 ${progress.failed}`)
    })
  }, [])

  useEffect(() => {
    return window.catMeme.onRenderProgress((progress) => {
      setRenderProgress(progress)
      const percent = Math.round(progress.percent * 100)
      const label = progress.mode === 'preview' ? '预览' : progress.mode === 'cover' ? '封面' : '导出'
      setNotice(`${label}：${progress.message} ${percent}%`)
    })
  }, [])

  useEffect(() => {
    if (!placementPulseItemId) return
    const timeout = window.setTimeout(() => {
      setPlacementPulseItemId((current) => (current === placementPulseItemId ? null : current))
    }, 760)
    return () => window.clearTimeout(timeout)
  }, [placementPulseItemId])

  const currentPreset = useMemo(() => {
    if (!project) return presets[0]
    if (project.exportPresetId === 'custom') return normalizeCustomPreset(project.customExportPreset)
    return presets.find((preset) => preset.id === project.exportPresetId) || presets[0]
  }, [presets, project])

  const totalFrames = useMemo(() => {
    if (!project || !currentPreset) return 300
    return projectDurationFrames(project, currentPreset.fps)
  }, [currentPreset, project])

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

  useEffect(() => {
    if (!project || !selectedKeyframe) return
    const item = project.timeline.find((entry) => entry.id === selectedKeyframe.itemId)
    if (!item || !visualKeyframes(item).some((keyframe) => keyframe.id === selectedKeyframe.keyframeId)) {
      setSelectedKeyframe(null)
    }
  }, [project, selectedKeyframe])

  useEffect(() => {
    if (selectedKeyframe && selectedItemId !== selectedKeyframe.itemId) setSelectedKeyframe(null)
  }, [selectedItemId, selectedKeyframe])

  useEffect(() => {
    if (!project || !selectedCue) return
    const item = project.timeline.find((entry) => entry.id === selectedCue.itemId)
    const cueExists =
      selectedCue.kind === 'subtitle'
        ? Boolean(item && isSubtitleStreamItem(item) && normalizeSubtitleCues(item.subtitleCues, item.durationFrames).some((cue) => cue.id === selectedCue.cueId))
        : Boolean(item && isRoleInstanceItem(item) && normalizeRoleStates(item.roleStates, item.durationFrames).some((state) => state.id === selectedCue.cueId))
    if (!cueExists) setSelectedCue(null)
  }, [project, selectedCue])

  const contextMenuItem = useMemo(
    () => project?.timeline.find((item) => item.id === contextMenu?.itemId) || null,
    [contextMenu, project]
  )

  const contextInputItem = useMemo(
    () => project?.timeline.find((item) => item.id === contextInput?.itemId) || null,
    [contextInput, project]
  )

  const timelineLookup = useMemo(() => (project ? createTimelineLookup(project) : null), [project])

  const previewTrackGroup = useMemo<TrackGroupId | null>(
    () => soloTrackGroup || (activeTrackGroup === 'all' ? null : activeTrackGroup),
    [activeTrackGroup, soloTrackGroup]
  )

  const activeVisualItems = useMemo(
    () => findActiveVisualItems(timelineLookup, playheadFrame, previewTrackGroup),
    [playheadFrame, previewTrackGroup, timelineLookup]
  )

  const activeSubtitleItems = useMemo(
    () => findActiveSubtitleItems(timelineLookup, playheadFrame, previewTrackGroup),
    [playheadFrame, previewTrackGroup, timelineLookup]
  )

  const activeAudioItems = useMemo(
    () => findPreviewAudioItems(timelineLookup, playheadFrame, previewTrackGroup),
    [playheadFrame, previewTrackGroup, timelineLookup]
  )

  useEffect(() => {
    setPlayheadFrame((frame) => Math.min(frame, totalFrames))
  }, [totalFrames])

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
      replaceProjectWithoutHistory(normalizeProject({ ...nextProject, assets: normalizedAssets }), { resetHistory: true })
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
    }, 0)
  }, [contextInput])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.isComposing) return
      if (isTypingTarget(event.target)) return

      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault()
        if (event.shiftKey) {
          if (canRedo) redoProject()
        } else if (canUndo) {
          undoProject()
        }
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') {
        event.preventDefault()
        if (canRedo) redoProject()
      } else if (event.code === 'Space' && !event.repeat) {
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
        activateEditorTool('razor')
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
        if (!deleteSelectedCue()) deleteSelectedItem()
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
      } else if (event.code === 'KeyT' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        activateEditorTool('text')
      } else if (event.code === 'KeyP' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        activateEditorTool('sticker')
      } else if (event.code === 'KeyA' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        activateEditorTool('audio')
      } else if (event.code === 'KeyE' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        activateEditorTool('animate')
      } else if (event.code === 'KeyH') {
        event.preventDefault()
        patchSelectedVisualTransform((transform) => ({ flipX: !transform.flipX }))
      } else if (event.code === 'KeyV' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        if (event.shiftKey) {
          patchSelectedVisualTransform((transform) => ({ flipY: !transform.flipY }))
        } else {
          activateEditorTool('select')
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
        if (activeTool !== 'select') activateEditorTool('select')
        setSelectedItemId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTool, canRedo, canUndo, clipClipboard, isPlaying, playheadFrame, project, selectedCue, selectedItem, totalFrames])

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
      commitProjectUpdate((current) => ({ ...current, assets: mergeAssets(current.assets, normalizedAssets) }), {
        label: '更新绿幕缓存'
      })
      setNotice(`透明缓存完成：成功 ${result.success}，跳过 ${result.skipped}，失败 ${result.failed}`)
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  async function cleanupGreenCache(): Promise<void> {
    try {
      setBusy('清理透明缓存')
      const result = await window.catMeme.cleanupGreenScreenCache()
      setNotice(`已清理未引用透明缓存 ${result.deleted} 个，释放 ${formatBytes(result.bytes)}`)
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setBusy(null)
    }
  }

  function patchAssetEverywhere(assetId: string, patch: Partial<Asset>): void {
    const patchOne = (asset: Asset): Asset => (asset.id === assetId ? normalizeAsset({ ...asset, ...patch }) || { ...asset, ...patch } : asset)
    setLocalAssets((current) => current.map(patchOne))
    patchProjectWithoutHistory((current) => ({ ...current, assets: current.assets.map(patchOne) }))
  }

  function toggleAssetFavorite(asset: Asset): void {
    const favorite = !asset.favorite
    patchAssetEverywhere(asset.id, { favorite })
    void window.catMeme.updateAsset(asset.id, { favorite }).then((saved) => {
      const normalized = normalizeAsset(saved)
      if (normalized) patchAssetEverywhere(asset.id, normalized)
    }).catch((error) => setNotice(errorText(error)))
  }

  function recordAssetUse(asset: Asset): void {
    const patch = {
      lastUsedAt: new Date().toISOString(),
      useCount: (asset.useCount || 0) + 1
    }
    patchAssetEverywhere(asset.id, patch)
    void window.catMeme.updateAsset(asset.id, patch).then((saved) => {
      const normalized = normalizeAsset(saved)
      if (normalized) patchAssetEverywhere(asset.id, normalized)
    }).catch((error) => setNotice(errorText(error)))
  }

  function activateEditorTool(tool: EditorToolId): void {
    setActiveTool(tool)
    if (tool === 'text') {
      window.setTimeout(() => quickSubtitleInputRef.current?.focus(), 0)
      setNotice('文字工具：输入一句话，或点击空画布添加字幕')
      return
    }
    if (tool === 'sticker') {
      setAssetPrimaryCategory('props')
      setAssetSubCategory('all')
      setActiveTrackGroup('effect')
      setNotice('贴纸工具：选择道具/贴纸素材后会优先放到特效轨')
      return
    }
    if (tool === 'audio') {
      setAssetPrimaryCategory('audio')
      setAssetSubCategory('all')
      setActiveTrackGroup('sfx')
      setNotice('音频工具：选择音效或 BGM 素材后会放到声音轨')
      return
    }
    if (tool === 'animate') {
      setNotice('动画工具：用下方 meme 动作给选中片段加贴脸、横跳、抖动或闪白')
      return
    }
    if (tool === 'razor') {
      setNotice('剃刀工具：点击时间线片段即可切开，按 V 返回选择')
      return
    }
    setNotice('选择/移动工具：拖动画布元素或时间线片段进行调整')
  }

  function addAssetToTimeline(asset: Asset, trackKind?: TrackKind): void {
    if (!project || !currentPreset) return
    const trackId = trackIdForAssetDrop(project, asset, selectedItem, trackKind, activeTool)
    const track = project.tracks.find((item) => item.id === trackId)
    const startFrame = track?.kind === 'visual' ? playheadFrame : nextStartFrame(project, trackId)
    addAssetToTimelineAt(asset, trackId, startFrame, undefined, { allowAutoTrack: true })
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
    const audioKind: TrackKind = isBgmAsset(asset) ? 'music' : 'sfx'
    const track = project.tracks.find((item) => item.id === trackIdForKind(project, audioKind, selectedItem)) || project.tracks.find((item) => item.kind === audioKind)
    if (track) addAssetToTimelineAt(asset, track.id, nextStartFrame(project, track.id))
  }

  function addRoleStateToTimelineAt(asset: Asset, track: TimelineTrack, startFrame: number): boolean {
    if (!project || !currentPreset) return false
    const totalFrames = projectDurationFrames(project, currentPreset.fps)
    const roles = projectRoles(project)
    const role = roleForTrack(project, track, roles)
    const durationFrames = Math.max(currentPreset.fps, Math.round((asset.duration || 2.4) * currentPreset.fps))
    const existing = project.timeline.find((item) => item.trackId === track.id && isRoleInstanceItem(item) && (!role || item.roleId === role.id))
    const streamDuration = Math.max(totalFrames, existing?.durationFrames || 0, startFrame + durationFrames)
    const baseStates = normalizeRoleStates(existing?.roleStates, streamDuration)
    const localStart = clampNumber(Math.round(startFrame - (existing?.startFrame || 0)), 0, Math.max(0, streamDuration - 1))
    const previousState = [...baseStates].reverse().find((state) => state.startFrame <= localStart)
    const previousAsset = previousState ? project.assets.find((item) => item.id === previousState.assetId) : undefined
    const state: RoleStateCue = {
      id: crypto.randomUUID(),
      assetId: asset.id,
      startFrame: localStart,
      durationFrames: Math.min(durationFrames, Math.max(1, streamDuration - localStart)),
      sourceInFrame: 0,
      muted: false,
      volume: 1,
      scale: defaultRoleStateScale(asset, previousAsset, previousState),
      offsetX: 0,
      offsetY: 0,
      fitMode: 'visible-bounds',
      label: asset.title || asset.filename,
      keying: isGreenScreenAsset(asset) ? { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 } : undefined
    }
    const nextStates = resolveRoleStateOverlaps([...baseStates, state], state.id, streamDuration)
    const roleItem: TimelineItem =
      existing ||
      createRoleStreamItem(project, track, streamDuration, role, asset)
    const nextRoleItem = {
      ...roleItem,
      durationFrames: streamDuration,
      roleStates: nextStates
    }
    const roleUpdates = role
      ? roles.map((item) => (item.id === role.id ? { ...item, defaultTrackId: track.id, memeAssetIds: uniqueStrings([asset.id, ...item.memeAssetIds]) } : item))
      : roles
    updateProject({
      ...project,
      assets: mergeAssets(project.assets, [asset]),
      roles: roleUpdates,
      timeline: existing ? project.timeline.map((item) => (item.id === existing.id ? nextRoleItem : item)) : [...project.timeline, nextRoleItem]
    })
    setSelectedItemId(nextRoleItem.id)
    setSelectedCue({ itemId: nextRoleItem.id, cueId: state.id, kind: 'role' })
    setSelectedTrackId(track.id)
    setNotice(existing ? `已添加角色状态：${assetDisplayName(asset)}` : `已创建角色流：${assetDisplayName(asset)}`)
    recordAssetUse(asset)
    return true
  }

  function addAssetToTimelineAt(
    asset: Asset,
    trackId: string,
    startFrame: number,
    transformOverride?: Partial<ReturnType<typeof normalizeTransform>>,
    options: { allowAutoTrack?: boolean } = {}
  ): boolean {
    if (!project || !currentPreset) return false
    const requestedTrack = project.tracks.find((track) => track.id === trackId)
    const fallbackTrackId = trackIdForAssetDrop(project, asset, selectedItem, undefined, activeTool)
    const track =
      requestedTrack && (!options.allowAutoTrack || canDropAssetOnTimelineTrack(project, asset, requestedTrack))
        ? requestedTrack
        : options.allowAutoTrack
          ? project.tracks.find((track) => track.id === fallbackTrackId)
          : undefined
    if (!track) {
      setNotice(`没有可投放 ${assetDisplayName(asset)} 的轨道`)
      return false
    }
    if (track.locked) {
      setNotice(`${displayTrackName(track)} 已锁定，不能投放素材`)
      return false
    }
    if (!canDropAssetOnTimelineTrack(project, asset, track)) {
      setNotice(assetDropBlockedMessage(asset, track))
      return false
    }
    if (track.kind === 'visual' && trackGroupId(track) === 'role' && isVisualAsset(asset) && !isBackgroundAsset(asset)) {
      return addRoleStateToTimelineAt(asset, track, startFrame)
    }
    const trackKind = track.kind
    const resolvedTrackId = track.id
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
      startFrame: Math.max(0, Math.round(startFrame)),
      durationFrames,
      sourceInFrame: 0,
      playbackRate: 1,
      effects: defaultEffectsForTrackKind(trackKind),
      volume: trackKind === 'music' ? 0.35 : 1,
      loop: false,
      transform:
        trackKind === 'visual'
          ? { ...defaultTransformForAsset(project, asset, resolvedTrackId, currentPreset), ...(isBackgroundAsset(asset) ? {} : transformOverride) }
          : undefined,
      keying: trackKind === 'visual' && isGreenScreenAsset(asset) ? { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 } : undefined
    }
    const addAssetMergeKey = `asset-add-${item.id}`
    updateProject(
      {
        ...project,
        assets: mergeAssets(project.assets, [asset]),
        timeline: [...project.timeline, item]
      },
      { label: '添加素材', mergeKey: addAssetMergeKey }
    )
    setSelectedItemId(item.id)
    if (trackKind === 'visual') setPlacementPulseItemId(item.id)
    setPlayheadFrame(item.startFrame)
    recordAssetUse(asset)
    if (trackKind === 'visual' && isGreenScreenAsset(asset)) {
      void detectFirstVisibleFrame(asset, currentPreset.fps, item.keying).then((sourceInFrame) => {
        if (sourceInFrame <= 0) return
        patchProjectWithoutHistory(
          (current) => {
            if (!current.timeline.some((timelineItem) => timelineItem.id === item.id)) return current
            return {
              ...current,
              timeline: current.timeline.map((timelineItem) =>
                timelineItem.id === item.id ? { ...timelineItem, sourceInFrame } : timelineItem
              )
            }
          },
          { mergeKey: addAssetMergeKey }
        )
      })
    }
    return true
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
    if (addAssetToTimelineAt(asset, trackId, playheadFrame, transform, { allowAutoTrack: true })) {
      setNotice(`已拖入画面：${asset.title || asset.filename}`)
    }
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
    const total = Math.max(projectDurationFrames(project, currentPreset.fps), currentPreset.fps * 8)
    const durationFrames = Math.max(currentPreset.fps, Math.floor(total / lines.length))
    const cues = lines.map<SubtitleCue>((text, index) => ({
      id: crypto.randomUUID(),
      startFrame: index * durationFrames,
      durationFrames,
      text
    }))
    const subtitleStream: TimelineItem = {
      id: crypto.randomUUID(),
      trackId: 'subtitles',
      type: 'subtitle',
      label: '字幕流 1',
      startFrame: 0,
      durationFrames: total,
      sourceInFrame: 0,
      playbackRate: 1,
      effects: [],
      style: project.subtitleStyle,
      subtitleBox: normalizeSubtitleBox(),
      subtitleCues: cues
    }
    updateProject({
      ...project,
      timeline: [...project.timeline.filter((item) => item.type !== 'subtitle'), subtitleStream]
    })
    setNotice('字幕已按脚本同步到时间轴')
  }

  function createSubtitleAtPlayhead(rawText: string, options: { allowFallback?: boolean; clearInput?: boolean; notice?: string } = {}): TimelineItem | null {
    if (!project || !currentPreset) return null
    const text = rawText.trim() || (options.allowFallback ? '新字幕' : '')
    if (!text) {
      setNotice('先输入一句字幕')
      return null
    }
    const subtitleTrack = project.tracks.find((track) => track.id === 'subtitles')
    if (subtitleTrack?.locked) {
      setNotice('字幕轨已锁定，不能添加字幕')
      return null
    }
    const durationFrames = Math.max(
      currentPreset.fps,
      Math.round((quickSubtitleSeconds > 0 ? quickSubtitleSeconds : lineDurationFrames(text, currentPreset.fps) / currentPreset.fps) * currentPreset.fps)
    )
    const tracks = project.tracks.some((track) => track.id === 'subtitles')
      ? project.tracks
      : [...project.tracks, { id: 'subtitles', name: '大字幕', kind: 'subtitle' as const, locked: false, muted: false }]
    const streamTrackId = selectedTrackId && tracks.find((track) => track.id === selectedTrackId && track.kind === 'subtitle') ? selectedTrackId : 'subtitles'
    const totalFrames = projectDurationFrames(project, currentPreset.fps)
    const existingStream =
      (selectedItem && isSubtitleStreamItem(selectedItem) ? selectedItem : null) ||
      project.timeline.find((item) => item.trackId === streamTrackId && isSubtitleStreamItem(item)) ||
      null
    const cue: SubtitleCue = {
      id: crypto.randomUUID(),
      startFrame: clampNumber(playheadFrame - (existingStream?.startFrame || 0), 0, Math.max(0, totalFrames - 1)),
      durationFrames: Math.min(durationFrames, Math.max(1, totalFrames - playheadFrame)),
      text
    }
    const subtitleItem: TimelineItem =
      existingStream ||
      {
        id: crypto.randomUUID(),
        trackId: streamTrackId,
        type: 'subtitle',
        label: `字幕流 ${project.timeline.filter((item) => item.type === 'subtitle').length + 1}`,
        startFrame: 0,
        durationFrames: totalFrames,
        sourceInFrame: 0,
        playbackRate: 1,
        effects: [],
        subtitleCues: [],
        subtitleBox: normalizeSubtitleBox(),
        speakerVisible: false,
        speakerPosition: 'bottom',
        style: project.subtitleStyle
      }
    const nextStream = {
      ...subtitleItem,
      startFrame: 0,
      durationFrames: totalFrames,
      subtitleCues: normalizeSubtitleCues([...(subtitleItem.subtitleCues || []), cue], totalFrames),
      subtitleBox: normalizeSubtitleBox(subtitleItem.subtitleBox),
      style: normalizeSubtitleStyleConfig({ ...project.subtitleStyle, ...subtitleItem.style })
    }
    const timeline = existingStream
      ? project.timeline.map((item) => (item.id === existingStream.id ? nextStream : item))
      : [...project.timeline, nextStream]
    updateProject({
      ...project,
      tracks,
      timeline
    })
    setSelectedItemId(nextStream.id)
    setSelectedCue({ itemId: nextStream.id, cueId: cue.id, kind: 'subtitle' })
    setSelectedTrackId(nextStream.trackId)
    if (options.clearInput) setQuickSubtitleText('')
    setNotice(options.notice || '已添加字幕 cue')
    return nextStream
  }

  function addQuickSubtitle(): void {
    createSubtitleAtPlayhead(quickSubtitleText, { clearInput: true })
  }

  function addCanvasTextSubtitle(): void {
    const created = createSubtitleAtPlayhead(quickSubtitleText, {
      allowFallback: true,
      clearInput: Boolean(quickSubtitleText.trim()),
      notice: '已在当前播放头添加画布字幕'
    })
    if (created) setActiveTool('select')
  }

  function createSubtitleStreamOnTrack(trackId: string): void {
    if (!project || !currentPreset) return
    const track = project.tracks.find((entry) => entry.id === trackId)
    if (!track || track.kind !== 'subtitle') return
    if (track.locked) {
      setNotice(`${displayTrackName(track)} 已锁定，不能创建字幕流`)
      return
    }
    const totalFrames = projectDurationFrames(project, currentPreset.fps)
    const existingStream = project.timeline.find((item) => item.trackId === trackId && isSubtitleStreamItem(item))
    const stream = existingStream || createSubtitleStreamItem(project, trackId, totalFrames, { label: `${displayTrackName(track)}流` })
    updateProject({
      ...project,
      timeline: existingStream
        ? project.timeline.map((item) => (item.id === existingStream.id ? { ...item, durationFrames: totalFrames } : item))
        : [...project.timeline, stream]
    })
    setSelectedItemId(stream.id)
    setSelectedCue(null)
    setSelectedTrackId(trackId)
    setNotice('已创建字幕流，当前帧添加按钮可继续追加 cue')
  }

  function createRoleStreamOnTrack(trackId: string): TimelineItem | null {
    if (!project || !currentPreset) return null
    const track = project.tracks.find((entry) => entry.id === trackId)
    if (!track || track.kind !== 'visual' || trackGroupId(track) !== 'role') return null
    if (track.locked) {
      setNotice(`${displayTrackName(track)} 已锁定，不能创建角色流`)
      return null
    }
    const totalFrames = projectDurationFrames(project, currentPreset.fps)
    const existingStream = project.timeline.find((item) => item.trackId === trackId && isRoleInstanceItem(item))
    const role = roleForTrack(project, track)
    const stream = existingStream || createRoleStreamItem(project, track, totalFrames, role)
    updateProject({
      ...project,
      timeline: existingStream
        ? project.timeline.map((item) => (item.id === existingStream.id ? { ...item, durationFrames: totalFrames } : item))
        : [...project.timeline, stream]
    })
    setSelectedItemId(stream.id)
    setSelectedCue(null)
    setSelectedTrackId(trackId)
    setNotice('已创建角色流，可把角色素材拖到此轨道形成状态 cue')
    return stream
  }

  function moveCueToTrack(args: { itemId: string; cueId: string; kind: 'subtitle' | 'role'; targetTrackId: string; absoluteFrame: number }): boolean {
    if (!project || !currentPreset) return false
    const source = project.timeline.find((item) => item.id === args.itemId)
    const targetTrack = project.tracks.find((track) => track.id === args.targetTrackId)
    if (!source || !targetTrack || targetTrack.locked) return false
    const totalFrames = projectDurationFrames(project, currentPreset.fps)

    if (args.kind === 'subtitle') {
      if (!isSubtitleStreamItem(source) || targetTrack.kind !== 'subtitle') return false
      const cue = normalizeSubtitleCues(source.subtitleCues, source.durationFrames).find((entry) => entry.id === args.cueId)
      if (!cue) return false
      const targetStream =
        project.timeline.find((item) => item.trackId === targetTrack.id && isSubtitleStreamItem(item)) ||
        createSubtitleStreamItem(project, targetTrack.id, totalFrames, { label: `${displayTrackName(targetTrack)}流` })
      const targetStart = clampNumber(args.absoluteFrame - targetStream.startFrame, 0, Math.max(0, targetStream.durationFrames - 1))
      const movedCue = {
        ...cue,
        startFrame: targetStart,
        durationFrames: Math.min(cue.durationFrames, Math.max(1, targetStream.durationFrames - targetStart))
      }
      const sourceCues = normalizeSubtitleCues(source.subtitleCues, source.durationFrames).filter((entry) => entry.id !== args.cueId)
      const targetExists = project.timeline.some((item) => item.id === targetStream.id)
      const nextTimeline = project.timeline
        .map((item) => {
          if (item.id === source.id) return { ...item, subtitleCues: sourceCues }
          if (item.id === targetStream.id) {
            return { ...item, subtitleCues: normalizeSubtitleCues([...(item.subtitleCues || []), movedCue], item.durationFrames) }
          }
          return item
        })
        .concat(targetExists ? [] : [{ ...targetStream, subtitleCues: normalizeSubtitleCues([movedCue], targetStream.durationFrames) }])
      updateProject({ ...project, timeline: nextTimeline })
      setSelectedItemId(targetStream.id)
      setSelectedCue({ itemId: targetStream.id, cueId: movedCue.id, kind: 'subtitle' })
      setSelectedTrackId(targetTrack.id)
      setPlayheadFrame(args.absoluteFrame)
      setNotice('已移动字幕 cue 到目标轨道')
      return true
    }

    if (!isRoleInstanceItem(source) || targetTrack.kind !== 'visual' || trackGroupId(targetTrack) !== 'role') return false
    const state = normalizeRoleStates(source.roleStates, source.durationFrames).find((entry) => entry.id === args.cueId)
    if (!state) return false
    const targetRole = roleForTrack(project, targetTrack)
    const targetStream =
      project.timeline.find((item) => item.trackId === targetTrack.id && isRoleInstanceItem(item)) ||
      createRoleStreamItem(project, targetTrack, totalFrames, targetRole)
    const targetStart = clampNumber(args.absoluteFrame - targetStream.startFrame, 0, Math.max(0, targetStream.durationFrames - 1))
    const movedState = {
      ...state,
      startFrame: targetStart,
      durationFrames: Math.min(state.durationFrames, Math.max(1, targetStream.durationFrames - targetStart))
    }
    const sourceStates = normalizeRoleStates(source.roleStates, source.durationFrames).filter((entry) => entry.id !== args.cueId)
    const targetExists = project.timeline.some((item) => item.id === targetStream.id)
    const nextTimeline = project.timeline
      .map((item) => {
        if (item.id === source.id) return { ...item, roleStates: sourceStates }
        if (item.id === targetStream.id) {
          return { ...item, roleStates: resolveRoleStateOverlaps([...(item.roleStates || []), movedState], movedState.id, item.durationFrames) }
        }
        return item
      })
      .concat(targetExists ? [] : [{ ...targetStream, roleStates: resolveRoleStateOverlaps([movedState], movedState.id, targetStream.durationFrames) }])
    updateProject({ ...project, timeline: nextTimeline })
    setSelectedItemId(targetStream.id)
    setSelectedCue({ itemId: targetStream.id, cueId: movedState.id, kind: 'role' })
    setSelectedTrackId(targetTrack.id)
    setPlayheadFrame(args.absoluteFrame)
    setNotice('已移动角色状态 cue 到目标角色轨')
    return true
  }

  function addRoleCueFromInspector(itemId: string, assetId: string, replaceCueId?: string): void {
    if (!project || !currentPreset) return
    const item = project.timeline.find((entry) => entry.id === itemId)
    const asset = project.assets.find((entry) => entry.id === assetId) || localAssets.find((entry) => entry.id === assetId)
    if (!item || !isRoleInstanceItem(item) || !asset || !isVisualAsset(asset) || isBackgroundAsset(asset)) return
    const states = normalizeRoleStates(item.roleStates, item.durationFrames)
    const localFrame = clampNumber(playheadFrame - item.startFrame, 0, Math.max(0, item.durationFrames - 1))
    const previousState = [...states].reverse().find((state) => state.startFrame <= localFrame)
    const previousAsset = previousState ? mergeAssets(project.assets, localAssets).find((entry) => entry.id === previousState.assetId) : undefined
    const durationFrames = Math.min(Math.max(currentPreset.fps, Math.round((asset.duration || 2.4) * currentPreset.fps)), Math.max(1, item.durationFrames - localFrame))
    let nextCueId = replaceCueId || crypto.randomUUID()
    const nextStates = replaceCueId
      ? states.map((state) =>
          state.id === replaceCueId
            ? {
                ...state,
                assetId: asset.id,
                label: asset.title || asset.filename,
                keying: isGreenScreenAsset(asset) ? { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 } : undefined,
                scale: state.scale ?? defaultRoleStateScale(asset, previousAsset, previousState)
              }
            : state
        )
      : [
          ...states,
          {
            id: nextCueId,
            assetId: asset.id,
            startFrame: localFrame,
            durationFrames,
            sourceInFrame: 0,
            muted: false,
            volume: 1,
            scale: defaultRoleStateScale(asset, previousAsset, previousState),
            offsetX: 0,
            offsetY: 0,
            fitMode: 'visible-bounds' as const,
            label: asset.title || asset.filename,
            keying: isGreenScreenAsset(asset) ? { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 } : undefined
          }
        ]
    if (replaceCueId && !states.some((state) => state.id === replaceCueId)) nextCueId = ''
    const roleStates = replaceCueId ? normalizeRoleStates(nextStates, item.durationFrames) : resolveRoleStateOverlaps(nextStates, nextCueId, item.durationFrames)
    updateProject({
      ...project,
      assets: mergeAssets(project.assets, [asset]),
      timeline: project.timeline.map((entry) => (entry.id === item.id ? { ...entry, roleStates } : entry))
    })
    if (nextCueId) setSelectedCue({ itemId: item.id, cueId: nextCueId, kind: 'role' })
    setSelectedItemId(item.id)
    setNotice(replaceCueId ? '已替换当前角色状态素材' : '已在当前帧新增角色状态 cue')
    recordAssetUse(asset)
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
      replaceProjectWithoutHistory(normalizeProject(result.project))
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
        replaceProjectWithoutHistory(normalizeProject(result.project), { resetHistory: true })
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
      replaceProjectWithoutHistory(normalizeProject(nextProject), { resetHistory: true })
      setSelectedItemId(null)
      setPreview(null)
      setNotice('已创建空工程')
    } catch (error) {
      setNotice(errorText(error))
    }
  }

  async function render(mode: 'preview' | 'export' | 'cover', outputPath?: string): Promise<void> {
    if (!project || !currentPreset) return
    try {
      const label = mode === 'preview' ? '预览' : mode === 'cover' ? '封面' : '视频'
      setBusy(mode === 'preview' ? '生成预览' : mode === 'cover' ? '导出封面' : '导出视频')
      setRenderProgress({ mode, stage: 'preparing', message: mode === 'preview' ? '准备生成预览' : mode === 'cover' ? '准备导出封面' : '准备导出视频', percent: 0 })
      const request = {
        project,
        preset: currentPreset,
        mode,
        outputPath,
        outputDir: mode === 'preview' ? undefined : settings?.defaultExportDir || workspace?.outputDir
      }
      const result =
        mode === 'preview'
          ? await window.catMeme.renderPreview(request)
          : mode === 'cover'
            ? await window.catMeme.renderCover(request)
            : await window.catMeme.renderExport(request)
      if (mode === 'preview') setPreview(result)
      if (mode === 'export') setLastExport(result)
      if (mode === 'cover') setLastCover(result)
      setNotice(`${label}已生成：${result.outputPath}`)
      setRenderProgress({ mode, stage: 'done', message: '渲染完成', percent: 1, outputPath: result.outputPath })
    } catch (error) {
      setNotice(errorText(error))
      setRenderProgress({ mode, stage: 'failed', message: '渲染失败', percent: 1, error: errorText(error) })
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

  function appendSubtitleCueToStream(
    baseProject: ProjectFile,
    stream: TimelineItem | null,
    trackId: string,
    cue: SubtitleCue,
    totalFrames: number,
    options: {
      role?: CharacterRole
      label?: string
      style?: Partial<ProjectFile['subtitleStyle']>
      binding?: TimelineItem['subtitleBinding']
      box?: Partial<SubtitleBox>
    } = {}
  ): { project: ProjectFile; stream: TimelineItem; cueId: string } {
    const tracks = baseProject.tracks.some((track) => track.id === trackId)
      ? baseProject.tracks
      : [...baseProject.tracks, makeSubtitleTrack(trackId)]
    const subtitleItem =
      stream ||
      createSubtitleStreamItem(baseProject, trackId, totalFrames, {
        label: options.label,
        style: options.style,
        binding: options.binding,
        roleId: options.role?.id,
        box: options.box
      })
    const nextStream = {
      ...subtitleItem,
      startFrame: 0,
      durationFrames: totalFrames,
      style: normalizeSubtitleStyleConfig({ ...baseProject.subtitleStyle, ...subtitleItem.style, ...options.style }),
      subtitleBinding: options.binding ?? subtitleItem.subtitleBinding,
      subtitleBox: normalizeSubtitleBox(subtitleItem.subtitleBox || options.box),
      subtitleCues: normalizeSubtitleCues([...(subtitleItem.subtitleCues || []), cue], totalFrames)
    }
    return {
      project: {
        ...baseProject,
        tracks,
        timeline: stream
          ? baseProject.timeline.map((item) => (item.id === stream.id ? nextStream : item))
          : [...baseProject.timeline, nextStream]
      },
      stream: nextStream,
      cueId: cue.id
    }
  }

  function appendRoleSubtitleCue(baseProject: ProjectFile, role: CharacterRole, line: string, startFrame: number, durationFrames: number): { project: ProjectFile; stream: TimelineItem; cueId: string } {
    const totalFrames = currentPreset ? projectDurationFrames(baseProject, currentPreset.fps) : Math.max(startFrame + durationFrames, 30)
    const existingStream = baseProject.timeline.find(
      (item) => isSubtitleStreamItem(item) && normalizeSubtitleBinding(item.subtitleBinding)?.roleId === role.id
    )
    const cue: SubtitleCue = {
      id: crypto.randomUUID(),
      startFrame: clampNumber(startFrame - (existingStream?.startFrame || 0), 0, Math.max(0, totalFrames - 1)),
      durationFrames: Math.min(durationFrames, Math.max(1, totalFrames - startFrame)),
      text: line
    }
    return appendSubtitleCueToStream(baseProject, existingStream || null, existingStream?.trackId || 'subtitles', cue, totalFrames, {
      role,
      label: `${role.name} 台词流`,
      style: { position: role.subtitlePosition },
      binding: { roleId: role.id, hideWhenRoleMissing: true },
      box: { widthPct: 64 }
    })
  }

  function placeRoleLineAtFrame(role: CharacterRole, line: string, startFrame: number, durationFrames = lineDurationFrames(line, currentPreset?.fps || 30)): void {
    if (!project || !currentPreset) return
    const result = appendRoleSubtitleCue(project, role, line, startFrame, durationFrames)
    updateProject(result.project)
    setSelectedItemId(result.stream.id)
    setSelectedCue({ itemId: result.stream.id, cueId: result.cueId, kind: 'subtitle' })
    setSelectedTrackId(result.stream.trackId)
    setNotice(`已投放 ${role.name} 台词`)
  }

  function placeRoleLine(role: CharacterRole, line: string): void {
    if (!project || !currentPreset) return
    const durationFrames = lineDurationFrames(line, currentPreset.fps)
    placeRoleLineAtFrame(role, line, playheadFrame, durationFrames)
  }

  function placeRoleScene(role: CharacterRole, asset: Asset, line: string): void {
    if (!project || !currentPreset) return
    const existingTrack = role.defaultTrackId ? project.tracks.find((track) => track.id === role.defaultTrackId) : null
    const track = existingTrack || makeRoleTrack(role)
    const tracks = existingTrack ? project.tracks : insertVisualTrack(project.tracks, track)
    const totalFrames = projectDurationFrames({ ...project, tracks }, currentPreset.fps)
    const durationFrames = Math.max(
      currentPreset.fps,
      Math.round((asset.duration || 3.2) * currentPreset.fps),
      line ? lineDurationFrames(line, currentPreset.fps) : 0
    )
    const existingStream = project.timeline.find((item) => item.trackId === track.id && isRoleInstanceItem(item) && item.roleId === role.id)
    const streamDuration = Math.max(totalFrames, existingStream?.durationFrames || 0)
    const localStart = clampNumber(playheadFrame - (existingStream?.startFrame || 0), 0, Math.max(0, streamDuration - 1))
    const baseStates = normalizeRoleStates(existingStream?.roleStates, streamDuration)
    const previousState = [...baseStates].reverse().find((state) => state.startFrame <= localStart)
    const previousAsset = previousState ? project.assets.find((item) => item.id === previousState.assetId) : undefined
    const state: RoleStateCue = {
      id: crypto.randomUUID(),
      assetId: asset.id,
      startFrame: localStart,
      durationFrames: Math.min(durationFrames, Math.max(1, streamDuration - localStart)),
      sourceInFrame: 0,
      muted: false,
      volume: 1,
      scale: defaultRoleStateScale(asset, previousAsset, previousState),
      offsetX: 0,
      offsetY: 0,
      fitMode: 'visible-bounds',
      label: asset.title || asset.filename,
      keying: isGreenScreenAsset(asset) ? { enabled: true, color: '#00ff00', similarity: 0.24, blend: 0.08 } : undefined
    }
    const roleStream = existingStream || createRoleStreamItem({ ...project, tracks }, track, streamDuration, role, asset)
    const nextRoleStream = {
      ...roleStream,
      durationFrames: streamDuration,
      roleStates: resolveRoleStateOverlaps([...baseStates, state], state.id, streamDuration)
    }
    const projectWithRoleStream: ProjectFile = {
      ...project,
      tracks,
      assets: mergeAssets(project.assets, [asset]),
      roles: projectRoles(project).map((item) =>
        item.id === role.id ? { ...item, defaultTrackId: track.id, memeAssetIds: uniqueStrings([asset.id, ...item.memeAssetIds]) } : item
      ),
      timeline: existingStream
        ? project.timeline.map((item) => (item.id === existingStream.id ? nextRoleStream : item))
        : [...project.timeline, nextRoleStream]
    }
    const result = line ? appendRoleSubtitleCue(projectWithRoleStream, role, line, playheadFrame, durationFrames) : null
    updateProject(result?.project || projectWithRoleStream)
    setSelectedItemId(nextRoleStream.id)
    setSelectedCue({ itemId: nextRoleStream.id, cueId: state.id, kind: 'role' })
    setSelectedTrackId(track.id)
    setPlayheadFrame(playheadFrame)
    setNotice(line ? `已投放 ${role.name} 镜头和台词` : `已投放 ${role.name} 镜头`)
  }

  function selectVisualKeyframe(itemId: string, keyframeId: string, absoluteFrame: number): void {
    setSelectedItemId(itemId)
    setSelectedKeyframe({ itemId, keyframeId })
    setPlayheadFrame(absoluteFrame)
  }

  function updateSelectedItem(patch: Partial<TimelineItem>, options: ProjectCommitOptions = {}): void {
    if (!project || !selectedItem) return
    const itemId = selectedItem.id
    commitProjectUpdate(
      (current) => ({
        ...current,
        timeline: current.timeline.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
      }),
      options
    )
  }

  function moveTimelineItem(itemId: string, patch: Partial<TimelineItem>, options: ProjectCommitOptions = {}): void {
    if (!project) return
    commitProjectUpdate(
      (current) => ({
        ...current,
        timeline: current.timeline.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
      }),
      options
    )
  }

  function moveTimelineItemKeyframe(itemId: string, keyframeId: string, localFrame: number): void {
    if (!project) return
    const item = project.timeline.find((entry) => entry.id === itemId)
    if (!item || item.type !== 'visual') return
    const moved = moveVisualKeyframe(item, keyframeId, localFrame)
    moveTimelineItem(itemId, { keyframes: moved.keyframes }, { label: '移动关键帧', mergeKey: `keyframe:${itemId}:${keyframeId}` })
    setSelectedKeyframe({ itemId, keyframeId })
    setPlayheadFrame(item.startFrame + moved.frame)
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
    if (!project || !currentPreset) return
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
    const tracks = insertTrackInGroup(project.tracks, track)
    const totalFrames = projectDurationFrames({ ...project, tracks }, currentPreset.fps)
    const role = groupId === 'role' && kind === 'visual' ? roleForTrack({ ...project, tracks }, track) : undefined
    const streamItem = groupId === 'role' && kind === 'visual' ? createRoleStreamItem({ ...project, tracks }, track, totalFrames, role) : null
    updateProject({ ...project, tracks, timeline: streamItem ? [...project.timeline, streamItem] : project.timeline })
    if (streamItem) {
      setSelectedItemId(streamItem.id)
      setSelectedCue(null)
    }
    setSelectedTrackId(track.id)
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
    if (isSubtitleStreamItem(item)) return splitSubtitleCueAtFrame(item, localFrame, frame)
    if (isRoleInstanceItem(item)) return splitRoleStateCueAtFrame(item, localFrame, frame)
    const keyframeParts = splitVisualKeyframesAtFrame(item, localFrame)
    const first: TimelineItem = { ...item, durationFrames: localFrame, keyframes: keyframeParts.first }
    const second: TimelineItem = {
      ...item,
      id: crypto.randomUUID(),
      startFrame: frame,
      sourceInFrame: item.sourceInFrame + Math.round(localFrame * itemPlaybackRate(item)),
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

  function splitSubtitleCueAtFrame(item: TimelineItem, localFrame: number, absoluteFrame: number): boolean {
    if (!project) return false
    const cues = normalizeSubtitleCues(item.subtitleCues, item.durationFrames)
    const cue = cues.find((entry) => localFrame > entry.startFrame && localFrame < entry.startFrame + entry.durationFrames)
    if (!cue) {
      setNotice('播放头需要位于字幕 cue 内部')
      return false
    }
    const splitOffset = localFrame - cue.startFrame
    const nextCue: SubtitleCue = {
      ...cue,
      id: crypto.randomUUID(),
      startFrame: localFrame,
      durationFrames: cue.durationFrames - splitOffset
    }
    const nextCues = cues.flatMap((entry) =>
      entry.id === cue.id
        ? [{ ...entry, durationFrames: splitOffset }, nextCue]
        : [entry]
    )
    updateProject({
      ...project,
      timeline: project.timeline.map((entry) => (entry.id === item.id ? { ...entry, subtitleCues: normalizeSubtitleCues(nextCues, item.durationFrames) } : entry))
    })
    setSelectedItemId(item.id)
    setSelectedTrackId(item.trackId)
    setPlayheadFrame(absoluteFrame)
    setNotice('已拆分当前字幕 cue')
    return true
  }

  function splitRoleStateCueAtFrame(item: TimelineItem, localFrame: number, absoluteFrame: number): boolean {
    if (!project) return false
    const states = normalizeRoleStates(item.roleStates, item.durationFrames)
    const state = states.find((entry) => localFrame > entry.startFrame && localFrame < entry.startFrame + entry.durationFrames)
    if (!state) {
      setNotice('播放头需要位于角色状态 cue 内部')
      return false
    }
    const splitOffset = localFrame - state.startFrame
    const rate = state.playbackRate ?? itemPlaybackRate(item)
    const nextState: RoleStateCue = {
      ...state,
      id: crypto.randomUUID(),
      startFrame: localFrame,
      sourceInFrame: Math.max(0, Math.round((state.sourceInFrame || 0) + splitOffset * rate)),
      durationFrames: state.durationFrames - splitOffset
    }
    const nextStates = states.flatMap((entry) =>
      entry.id === state.id
        ? [{ ...entry, durationFrames: splitOffset }, nextState]
        : [entry]
    )
    updateProject({
      ...project,
      timeline: project.timeline.map((entry) => (entry.id === item.id ? { ...entry, roleStates: normalizeRoleStates(nextStates, item.durationFrames) } : entry))
    })
    setSelectedItemId(item.id)
    setSelectedTrackId(item.trackId)
    setPlayheadFrame(absoluteFrame)
    setNotice('已拆分当前角色状态 cue')
    return true
  }

  function trimSelectedStartToPlayhead(): void {
    if (!selectedItem) return
    const delta = playheadFrame - selectedItem.startFrame
    if (delta <= 0 || delta >= selectedItem.durationFrames) return
    updateSelectedItem({
      startFrame: playheadFrame,
      durationFrames: selectedItem.durationFrames - delta,
      sourceInFrame: selectedItem.sourceInFrame + Math.round(delta * itemPlaybackRate(selectedItem))
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

  function applyMemeAction(action: MemeActionId): void {
    if (!project || !currentPreset || !selectedItem || selectedItem.type !== 'visual') {
      setNotice('先选中一个画面里的猫/贴纸片段')
      return
    }
    const track = project.tracks.find((entry) => entry.id === selectedItem.trackId)
    if (track?.locked) {
      setNotice(`${displayTrackName(track)} 已锁定，不能修改片段`)
      return
    }

    const localFrame = localFrameForItem(selectedItem, playheadFrame)
    const baseTransform = visualTransformAtFrame(selectedItem, localFrame)
    const frameStep = Math.max(2, Math.round(currentPreset.fps * 0.12))
    const effectFor = (type: TimelineItem['effects'][number]['type'], intensity: number): TimelineItem['effects'][number] => {
      const preset = DEFAULT_EFFECTS.find((item) => item.type === type)
      return { ...(preset || { type, intensity, id: crypto.randomUUID() }), id: crypto.randomUUID(), intensity }
    }

    if (action === 'flip-x') {
      patchSelectedVisualTransform((transform) => ({ flipX: !transform.flipX }))
      setNotice('已水平翻转')
      return
    }
    if (action === 'flip-y') {
      patchSelectedVisualTransform((transform) => ({ flipY: !transform.flipY }))
      setNotice('已垂直翻转')
      return
    }
    if (action === 'reset') {
      patchSelectedVisualTransform(() => ({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 }))
      setNotice('已重置画面变换')
      return
    }
    if (action === 'shake' || action === 'flash') {
      const nextEffect = effectFor(action, action === 'shake' ? 0.36 : 0.34)
      updateSelectedItem({
        effects: [nextEffect, ...selectedItem.effects.filter((effect) => effect.type !== action && effect.type !== 'none')]
      })
      setNotice(action === 'shake' ? '已添加抖动效果' : '已添加闪白效果')
      return
    }
    if (action === 'punch-in') {
      const endFrame = clampNumber(localFrame + Math.round(currentPreset.fps * 0.2), 0, Math.max(0, selectedItem.durationFrames - 1))
      const zoomTransform = { ...baseTransform, scale: clampNumber(baseTransform.scale * 1.45, 0.08, 4) }
      const keyframes = mergeVisualActionKeyframes(selectedItem, [
        { frame: localFrame, transform: baseTransform },
        { frame: endFrame, transform: zoomTransform }
      ])
      const selectedActionKeyframe = keyframes.find((keyframe) => keyframe.frame === endFrame) || keyframes.find((keyframe) => keyframe.frame === localFrame)
      updateSelectedItem({ keyframes }, { label: '添加贴脸关键帧', mergeKey: `keyframe:${selectedItem.id}:punch-in` })
      if (selectedActionKeyframe) selectVisualKeyframe(selectedItem.id, selectedActionKeyframe.id, selectedItem.startFrame + selectedActionKeyframe.frame)
      setNotice('已添加突然贴脸关键帧')
      return
    }
    if (action === 'side-hop') {
      const amplitude = Math.round(currentPreset.width * 0.08)
      const keyframes = mergeVisualActionKeyframes(selectedItem, [
        { frame: localFrame, transform: baseTransform },
        { frame: localFrame + frameStep, transform: { ...baseTransform, x: baseTransform.x - amplitude } },
        { frame: localFrame + frameStep * 2, transform: { ...baseTransform, x: baseTransform.x + amplitude } },
        { frame: localFrame + frameStep * 3, transform: baseTransform }
      ])
      const selectedActionKeyframe = keyframes.find((keyframe) => keyframe.frame === clampNumber(localFrame + frameStep, 0, Math.max(0, selectedItem.durationFrames - 1)))
      updateSelectedItem({ keyframes }, { label: '添加横跳关键帧', mergeKey: `keyframe:${selectedItem.id}:side-hop` })
      if (selectedActionKeyframe) selectVisualKeyframe(selectedItem.id, selectedActionKeyframe.id, selectedItem.startFrame + selectedActionKeyframe.frame)
      setNotice('已添加左右横跳关键帧')
      return
    }
    if (action === 'repeat') {
      const itemEnd = selectedItem.startFrame + selectedItem.durationFrames
      const segmentStart = clampNumber(playheadFrame, selectedItem.startFrame, itemEnd - 1)
      const segmentDuration = Math.max(1, Math.min(Math.round(currentPreset.fps * 0.5), itemEnd - segmentStart))
      const sourceInFrame = selectedItem.sourceInFrame + Math.round((segmentStart - selectedItem.startFrame) * itemPlaybackRate(selectedItem))
      const segmentTransform = visualTransformAtFrame(selectedItem, segmentStart - selectedItem.startFrame)
      const copies = [1, 2].map((index) => ({
        ...selectedItem,
        id: crypto.randomUUID(),
        startFrame: segmentStart + segmentDuration * index,
        durationFrames: segmentDuration,
        sourceInFrame,
        label: `${selectedItem.label} 复读 ${index}`,
        transform: segmentTransform,
        keyframes: undefined
      }))
      updateProject({ ...project, timeline: [...project.timeline, ...copies] })
      setSelectedItemId(copies[0]?.id || selectedItem.id)
      setPlayheadFrame(copies[0]?.startFrame || playheadFrame)
      setNotice('已复制当前片段做一键复读')
    }
  }

  function deleteSelectedItem(): void {
    if (!project || !selectedItem) return
    updateProject({
      ...project,
      timeline: project.timeline.filter((item) => item.id !== selectedItem.id)
    })
    setSelectedItemId(null)
    setSelectedCue(null)
  }

  function deleteSelectedCue(): boolean {
    if (!project || !selectedCue) return false
    const item = project.timeline.find((entry) => entry.id === selectedCue.itemId)
    if (!item) return false
    if (selectedCue.kind === 'subtitle' && isSubtitleStreamItem(item)) {
      updateProject({
        ...project,
        timeline: project.timeline.map((entry) =>
          entry.id === item.id ? { ...entry, subtitleCues: normalizeSubtitleCues(item.subtitleCues, item.durationFrames).filter((cue) => cue.id !== selectedCue.cueId) } : entry
        )
      })
      setSelectedCue(null)
      setNotice('已删除字幕 cue')
      return true
    }
    if (selectedCue.kind === 'role' && isRoleInstanceItem(item)) {
      updateProject({
        ...project,
        timeline: project.timeline.map((entry) =>
          entry.id === item.id ? { ...entry, roleStates: normalizeRoleStates(item.roleStates, item.durationFrames).filter((state) => state.id !== selectedCue.cueId) } : entry
        )
      })
      setSelectedCue(null)
      setNotice('已删除角色状态 cue')
      return true
    }
    return false
  }

  function openItemContextMenu(itemId: string, clientX: number, clientY: number): void {
    setSelectedItemId(itemId)
    setContextMenu({ itemId, x: clientX, y: clientY })
  }

  function addContextName(item: TimelineItem): void {
    if (item.type !== 'visual') return
    setContextInput({
      itemId: item.id,
      kind: 'name',
      x: contextMenu?.x || window.innerWidth / 2,
      y: contextMenu?.y || window.innerHeight / 2,
      value: roleLabelForItem(project, item).text || item.label || ''
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

  function roleForTimelineItem(item: TimelineItem): CharacterRole | undefined {
    if (!project) return undefined
    const roles = projectRoles(project)
    if (item.roleId) {
      const role = roles.find((entry) => entry.id === item.roleId)
      if (role) return role
    }
    const track = project.tracks.find((entry) => entry.id === item.trackId)
    return track && track.kind === 'visual' && trackGroupId(track) === 'role' ? roleForTrack(project, track, roles) : undefined
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
      if (contextInputItem.type === 'visual') {
        moveTimelineItem(contextInputItem.id, {
          roleLabel: mergeRoleLabelPatch(project, contextInputItem, { text: value, visible: true })
        })
        setNotice('已绑定角色名称')
      }
    } else {
      const role = contextInputItem.type === 'visual' ? roleForTimelineItem(contextInputItem) : undefined
      if (role) {
        const startFrame = clampNumber(playheadFrame, contextInputItem.startFrame, Math.max(contextInputItem.startFrame, contextInputItem.startFrame + contextInputItem.durationFrames - 1))
        placeRoleLineAtFrame(role, value, startFrame, lineDurationFrames(value, currentPreset?.fps || 30))
      } else {
        upsertContextSubtitle(contextInputItem, { text: value, style: project.subtitleStyle })
      }
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
    setSelectedCue(null)
    setSelectedKeyframe(null)
    const item = itemId ? project?.timeline.find((entry) => entry.id === itemId) : null
    if (item) setSelectedTrackId(item.trackId)
  }

  function selectTrack(trackId: string, clearItem = true): void {
    setSelectedTrackId(trackId)
    if (clearItem) {
      setSelectedItemId(null)
      setSelectedCue(null)
    }
  }

  function selectTimelineCue(itemId: string, cueId: string, kind: SelectedCueRef['kind'], absoluteFrame?: number): void {
    setSelectedItemId(itemId)
    setSelectedCue({ itemId, cueId, kind })
    setSelectedKeyframe(null)
    const item = project?.timeline.find((entry) => entry.id === itemId)
    if (item) setSelectedTrackId(item.trackId)
    if (typeof absoluteFrame === 'number') setPlayheadFrame(clampNumber(absoluteFrame, 0, totalFrames))
  }

  function changeActiveTrackGroup(group: TrackGroupFilter): void {
    setActiveTrackGroup(group)
    const track = group === 'all' ? project?.tracks[0] : project?.tracks.find((item) => trackGroupId(item) === group)
    if (track) selectTrack(track.id)
  }

  function commitProjectChange(nextProject: ProjectFile, options: ProjectCommitOptions = {}): void {
    const before = projectRef.current
    if (!before) return
    const after = prepareProjectForHistory(nextProject, currentPreset?.fps || 30)
    if (projectHistoryKey(before) === projectHistoryKey(after)) return

    const entry: ProjectHistoryEntry = {
      before: cloneProjectSnapshot(before),
      after: cloneProjectSnapshot(after),
      label: options.label || '编辑工程',
      mergeKey: options.mergeKey
    }
    pushProjectHistory(entry)
    setRedoHistory([])
    applyProjectState(after)
  }

  function commitProjectUpdate(getNextProject: (current: ProjectFile) => ProjectFile, options: ProjectCommitOptions = {}): void {
    const before = projectRef.current
    if (!before) return
    commitProjectChange(getNextProject(before), options)
  }

  function patchProjectWithoutHistory(getNextProject: (current: ProjectFile) => ProjectFile, options: ProjectCommitOptions = {}): void {
    const current = projectRef.current
    if (!current) return
    const nextProject = prepareProjectForHistory(getNextProject(current), currentPreset?.fps || 30)
    if (projectHistoryKey(current) === projectHistoryKey(nextProject)) return
    applyProjectState(nextProject)
    if (options.mergeKey) updateLatestHistoryAfter(nextProject, options.mergeKey)
  }

  function replaceProjectWithoutHistory(nextProject: ProjectFile, options: ProjectReplaceOptions = {}): void {
    applyProjectState(prepareProjectForHistory(nextProject, currentPreset?.fps || 30))
    if (options.resetHistory) {
      setUndoHistory([])
      setRedoHistory([])
    }
  }

  function applyProjectState(nextProject: ProjectFile): void {
    const snapshot = cloneProjectSnapshot(nextProject)
    projectRef.current = snapshot
    setProject(snapshot)
    reconcileProjectSelection(snapshot)
  }

  function reconcileProjectSelection(nextProject: ProjectFile): void {
    setSelectedItemId((current) => (current && nextProject.timeline.some((item) => item.id === current) ? current : null))
    setSelectedCue((current) => {
      if (!current) return null
      const item = nextProject.timeline.find((entry) => entry.id === current.itemId)
      const cueExists =
        current.kind === 'subtitle'
          ? Boolean(item && isSubtitleStreamItem(item) && normalizeSubtitleCues(item.subtitleCues, item.durationFrames).some((cue) => cue.id === current.cueId))
          : Boolean(item && isRoleInstanceItem(item) && normalizeRoleStates(item.roleStates, item.durationFrames).some((state) => state.id === current.cueId))
      return cueExists ? current : null
    })
    setSelectedTrackId((current) =>
      current && nextProject.tracks.some((track) => track.id === current) ? current : nextProject.tracks[0]?.id || null
    )
  }

  function pushProjectHistory(entry: ProjectHistoryEntry): void {
    const stack = undoStackRef.current
    const lastEntry = stack[stack.length - 1]
    if (entry.mergeKey && lastEntry?.mergeKey === entry.mergeKey) {
      setUndoHistory([
        ...stack.slice(0, -1),
        {
          ...lastEntry,
          after: entry.after,
          label: entry.label || lastEntry.label
        }
      ])
      return
    }
    const nextStack = [...stack, entry]
    setUndoHistory(nextStack.length > PROJECT_HISTORY_LIMIT ? nextStack.slice(nextStack.length - PROJECT_HISTORY_LIMIT) : nextStack)
  }

  function updateLatestHistoryAfter(nextProject: ProjectFile, mergeKey: string): void {
    const after = cloneProjectSnapshot(nextProject)
    const stack = undoStackRef.current
    const lastEntry = stack[stack.length - 1]
    if (!lastEntry || lastEntry.mergeKey !== mergeKey) return
    setUndoHistory([...stack.slice(0, -1), { ...lastEntry, after }])
  }

  function undoProject(): void {
    const stack = undoStackRef.current
    const entry = stack[stack.length - 1]
    if (!entry) return
    setUndoHistory(stack.slice(0, -1))
    setRedoHistory([...redoStackRef.current, entry].slice(-PROJECT_HISTORY_LIMIT))
    applyProjectState(entry.before)
    setNotice(`已撤回：${entry.label}`)
  }

  function redoProject(): void {
    const stack = redoStackRef.current
    const entry = stack[stack.length - 1]
    if (!entry) return
    setRedoHistory(stack.slice(0, -1))
    setUndoHistory([...undoStackRef.current, entry].slice(-PROJECT_HISTORY_LIMIT))
    applyProjectState(entry.after)
    setNotice(`已重做：${entry.label}`)
  }

  function setUndoHistory(stack: ProjectHistoryEntry[]): void {
    undoStackRef.current = stack
    setUndoStack(stack)
  }

  function setRedoHistory(stack: ProjectHistoryEntry[]): void {
    redoStackRef.current = stack
    setRedoStack(stack)
  }

  function updateProject(nextProject: ProjectFile, options: ProjectCommitOptions = {}): void {
    commitProjectChange(nextProject, options)
  }

  function setProjectDurationFrames(frames: number): void {
    if (!project || !currentPreset) return
    const minFrames = Math.max(projectContentEndFrame(project), currentPreset.fps)
    const nextFrames = Math.max(minFrames, Math.round(frames))
    updateProject({ ...project, durationSeconds: secondsFromFrames(nextFrames, currentPreset.fps) }, { label: '调整总时长' })
    setPlayheadFrame((frame) => Math.min(frame, nextFrames))
  }

  function setProjectDurationSeconds(seconds: number): void {
    if (!currentPreset) return
    setProjectDurationFrames(Math.round(seconds * currentPreset.fps))
  }

  function addAssetsToProject(assets: Asset[]): void {
    commitProjectUpdate((current) => ({ ...current, assets: mergeAssets(current.assets, assets) }), { label: '导入素材' })
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
    <main className="app-shell" data-can-undo={canUndo} data-can-redo={canRedo}>
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
        {renderProgress && ['preparing', 'building-filters', 'encoding'].includes(renderProgress.stage) && (
          <div className="status-progress" title={renderProgress.message}>
            <span style={{ width: `${Math.round(renderProgress.percent * 100)}%` }} />
          </div>
        )}
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
          onCleanupGreen={cleanupGreenCache}
          preprocessProgress={preprocessProgress}
          onAdd={addAssetToTimeline}
          onAddToPurpose={addAssetToPurpose}
          onToggleFavorite={toggleAssetFavorite}
          onShowFile={(asset) => window.catMeme.showItem(asset.localPath)}
        />

        <section className="center-panel">
          <div className="preview-and-inspector preview-canvas-panel">
            <div className="preview-wrap">
              <PanelTitle icon={<Film />} title="预览" />
              <div className="preview-workarea">
                <EditorToolRail activeTool={activeTool} onChange={activateEditorTool} />
                <div className="phone-preview">
                  <QuickPreview
                    project={project}
                    items={activeVisualItems}
                    audioItems={activeAudioItems}
                    subtitles={activeSubtitleItems}
                    selectedItemId={selectedItemId}
                    placementPulseItemId={placementPulseItemId}
                    playheadFrame={playheadFrame}
                    fps={currentPreset.fps}
                    presetWidth={currentPreset.width}
                    presetHeight={currentPreset.height}
                    isPlaying={isPlaying}
                    playbackRate={playerSpeed}
                    activeTool={activeTool}
                    onSelect={selectTimelineItem}
                    onClearSelection={() => setSelectedItemId(null)}
                    onPatchItem={moveTimelineItem}
                    onItemContextMenu={openItemContextMenu}
                    onDropAsset={addAssetToPreview}
                    onCreateSubtitle={addCanvasTextSubtitle}
                  />
                </div>
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
                <label className="preview-speed-control">
                  <span>预览速度</span>
                  <select className="speed-select" value={playerSpeed} onChange={(event) => setPlayerSpeed(Number(event.target.value))}>
                    <option value={0.5}>0.5x</option>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={4}>4x</option>
                  </select>
                </label>
              </div>
              <MemeActionStrip selectedItem={selectedItem} onAction={applyMemeAction} />
            </div>
          </div>
          <div className="timeline-header">
            <div className="quick-subtitle-bar">
              <div className="asset-search-row quick-subtitle-input">
                <Captions size={15} />
                <input
                  ref={quickSubtitleInputRef}
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
                <div className="duration-quick-controls" aria-label="工程总时长">
                  {[15, 30, 60].map((seconds) => (
                    <button className="mini-link" type="button" key={seconds} onClick={() => setProjectDurationSeconds(seconds)}>
                      {seconds}s
                    </button>
                  ))}
                  <label className="duration-input">
                    <span>工程秒</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={Math.round(totalFrames / currentPreset.fps)}
                      onChange={(event) => setProjectDurationSeconds(Number(event.target.value) || 1)}
                    />
                  </label>
                </div>
                <span>{currentPreset.fps}fps</span>
                <span>Frame {playheadFrame}</span>
                <span>{formatTime(playheadFrame, currentPreset.fps)}</span>
                <span>缩放视图 {Math.round(timelineZoom * 100)}%</span>
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
            selectedCue={selectedCue}
            selectedKeyframe={selectedKeyframe}
            playheadFrame={playheadFrame}
            activeGroup={activeTrackGroup}
            soloGroup={soloTrackGroup}
            selectedTrackId={selectedTrack?.id || null}
            onSelect={selectTimelineItem}
            onSelectKeyframe={selectVisualKeyframe}
            onMoveKeyframe={moveTimelineItemKeyframe}
            onSelectTrack={selectTrack}
            onSeek={setPlayheadFrame}
            onPatchItem={moveTimelineItem}
            onPatchTrack={patchTrack}
            onPatchGroup={patchTrackGroup}
            onSelectCue={selectTimelineCue}
            onMoveCueToTrack={moveCueToTrack}
            onCreateSubtitleStream={createSubtitleStreamOnTrack}
            onCreateRoleStream={createRoleStreamOnTrack}
            onAddTrack={(groupId, kind) => addTrackForGroup(groupId, kind)}
            onDeleteTrack={deleteTrack}
            onReorderTrack={reorderTrack}
            onActiveGroupChange={changeActiveTrackGroup}
            onSoloGroupChange={setSoloTrackGroup}
            onSelectGroupItems={selectTrackGroupItems}
            onTotalFramesChange={setProjectDurationFrames}
            timelineZoom={timelineZoom}
            onTimelineZoom={setTimelineZoom}
            snapEnabled={timelineSnapEnabled}
            onSnapToggle={() => setTimelineSnapEnabled((value) => !value)}
            razorMode={razorMode}
            onRazorModeChange={(enabled) => activateEditorTool(enabled ? 'razor' : 'select')}
            onCutItemAtFrame={cutItemAtFrame}
            onItemContextMenu={openItemContextMenu}
            onDropAsset={(assetId, trackId, frame) => {
              const asset = project.assets.find((item) => item.id === assetId) || localAssets.find((item) => item.id === assetId)
              return asset ? addAssetToTimelineAt(asset, trackId, frame) : false
            }}
            onDropAssetToDefaultTrack={(assetId, frame) => {
              const asset = project.assets.find((item) => item.id === assetId) || localAssets.find((item) => item.id === assetId)
              return asset ? addAssetToTimelineAt(asset, trackIdForAssetDrop(project, asset, selectedItem, undefined, activeTool), frame, undefined, { allowAutoTrack: true }) : false
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
            selectedCue={selectedCue}
            selectedKeyframe={selectedKeyframe}
            playheadFrame={playheadFrame}
            lastExport={lastExport}
            availableAssets={mergeAssets(project.assets, localAssets)}
            onPatchTrack={patchTrack}
            onPatchItem={updateSelectedItem}
            onCreateSubtitleStream={createSubtitleStreamOnTrack}
            onSelectCue={selectTimelineCue}
            onAddRoleCue={addRoleCueFromInspector}
            onProjectDurationChange={setProjectDurationSeconds}
            onSelectKeyframe={selectVisualKeyframe}
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
              lastCover={lastCover}
              onChangeCustomPreset={updateCustomPreset}
              onChooseExportDir={() => void chooseExportDir()}
              onPreview={() => void render('preview')}
              onExport={() => void render('export')}
              onExportCover={() => void render('cover')}
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
          <button disabled={contextMenuItem.type !== 'visual'} onClick={() => { addContextName(contextMenuItem); setContextMenu(null) }}>
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
  onCleanupGreen,
  preprocessProgress,
  onAdd,
  onAddToPurpose,
  onToggleFavorite,
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
  onCleanupGreen: () => Promise<void>
  preprocessProgress: GreenScreenPreprocessProgress | null
  onAdd: (asset: Asset, trackKind?: TrackKind) => void
  onAddToPurpose: (asset: Asset, purpose: 'background' | 'role' | 'audio') => void
  onToggleFavorite: (asset: Asset) => void
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
            <button className="mini-link" disabled={preprocessing} onClick={onCleanupGreen}>
              清理无引用
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
            onToggleFavorite={onToggleFavorite}
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
  onToggleFavorite,
  onShowFile
}: {
  assets: Asset[]
  viewMode: AssetViewMode
  onAdd: (asset: Asset, trackKind?: TrackKind) => void
  onAddToPurpose: (asset: Asset, purpose: 'background' | 'role' | 'audio') => void
  onToggleFavorite: (asset: Asset) => void
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
            onToggleFavorite={onToggleFavorite}
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

function EditorToolRail({ activeTool, onChange }: { activeTool: EditorToolId; onChange: (tool: EditorToolId) => void }): JSX.Element {
  const tools: Array<{ id: EditorToolId; label: string; shortcut: string; icon: JSX.Element }> = [
    { id: 'select', label: '选择/移动', shortcut: 'V', icon: <MousePointer2 /> },
    { id: 'razor', label: '切割', shortcut: 'C', icon: <Scissors /> },
    { id: 'text', label: '文字', shortcut: 'T', icon: <Type /> },
    { id: 'sticker', label: '贴纸/道具', shortcut: 'P', icon: <Sticker /> },
    { id: 'audio', label: '音频', shortcut: 'A', icon: <AudioLines /> },
    { id: 'animate', label: '动画动作', shortcut: 'E', icon: <WandSparkles /> }
  ]
  return (
    <div className="editor-tool-rail" aria-label="编辑工具">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={activeTool === tool.id ? 'editor-tool-button active' : 'editor-tool-button'}
          title={`${tool.label} (${tool.shortcut})`}
          onClick={() => onChange(tool.id)}
        >
          {tool.icon}
          <span>{tool.shortcut}</span>
        </button>
      ))}
    </div>
  )
}

function MemeActionStrip({ selectedItem, onAction }: { selectedItem: TimelineItem | null; onAction: (action: MemeActionId) => void }): JSX.Element {
  const hasVisual = selectedItem?.type === 'visual'
  const actions: Array<{ id: MemeActionId; label: string; icon: JSX.Element }> = [
    { id: 'punch-in', label: '突然贴脸', icon: <Crosshair /> },
    { id: 'side-hop', label: '左右横跳', icon: <Move /> },
    { id: 'shake', label: '抖动', icon: <ZapIcon /> },
    { id: 'flash', label: '闪白', icon: <Sparkles /> },
    { id: 'repeat', label: '一键复读', icon: <Repeat2 /> },
    { id: 'flip-x', label: '水平翻转', icon: <FlipHorizontal /> },
    { id: 'flip-y', label: '垂直翻转', icon: <FlipVertical /> },
    { id: 'reset', label: '重置变换', icon: <RotateCcw /> }
  ]
  return (
    <div className="meme-action-strip" aria-label="Meme 动作">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="meme-action-button"
          disabled={!hasVisual}
          title={hasVisual ? action.label : '先选中一个画面片段'}
          onClick={() => onAction(action.id)}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  )
}

function ZapIcon(): JSX.Element {
  return <Sparkles />
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
      <span>Ctrl+滚轮 缩放视图</span>
      <span>V 选择</span>
      <span>C 剃刀</span>
      <span>T 文字</span>
      <span>P 贴纸</span>
      <span>A 音频</span>
      <span>E 动画</span>
      <span>H/Shift+V 对称</span>
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
  onToggleFavorite,
  onShowFile
}: {
  asset: Asset
  viewMode: AssetViewMode
  onAdd: (asset: Asset, trackKind?: TrackKind) => void
  onAddToPurpose: (asset: Asset, purpose: 'background' | 'role' | 'audio') => void
  onToggleFavorite: (asset: Asset) => void
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
        onAdd(asset)
      }}
      onDoubleClick={() => onAdd(asset)}
      title="拖到预览画面或时间轴；右键加入当前帧"
    >
      <div className="asset-thumb-wrap">
        <MemoAssetThumbnail asset={asset} active={previewActive} />
        <button
          type="button"
          className={asset.favorite ? 'asset-favorite active' : 'asset-favorite'}
          title={asset.favorite ? '取消收藏' : '收藏素材'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite(asset)
          }}
        >
          <Star size={15} fill={asset.favorite ? 'currentColor' : 'none'} />
        </button>
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
        <IconButton title={isAudio ? '加入音频轨' : '加入画面'} onClick={() => onAdd(asset)} icon={isAudio ? <Music2 /> : <ImageIcon />} />
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
  const cacheKey = asset.fileUrl || asset.localPath || asset.id
  const [cachedFrame, setCachedFrame] = useState(() => greenThumbFrameCache.get(cacheKey) || '')
  const [hasFrame, setHasFrame] = useState(false)
  const [fallback, setFallback] = useState(false)

  function draw(): void {
    const canvas = canvasRef.current
    const media = videoRef.current
    if (!canvas || !media || !mediaReady(media)) return
    canvas.width = 360
    canvas.height = 220
    drawKeyedFrame(canvas, media, { enabled: true, color: '#00ff00', similarity: 0.28, blend: 0.08 }, false)
    const frame = canvas.toDataURL('image/webp', 0.72)
    greenThumbFrameCache.set(cacheKey, frame)
    setCachedFrame(frame)
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
    setCachedFrame(greenThumbFrameCache.get(cacheKey) || '')
    setHasFrame(false)
    setFallback(false)
    const timer = window.setTimeout(() => {
      if (!drewFrameRef.current) setFallback(true)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [cacheKey])

  if (fallback) return <MediaThumb src={asset.fileUrl} type={asset.type} />
  if (cachedFrame) return <img className="thumb" src={cachedFrame} alt="" loading="lazy" decoding="async" />

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
  const cacheKey = asset.fileUrl || asset.localPath || asset.id
  const [cachedFrame, setCachedFrame] = useState(() => greenThumbFrameCache.get(cacheKey) || '')

  function draw(): void {
    const canvas = canvasRef.current
    const media = imageRef.current
    if (!canvas || !media || !mediaReady(media)) return
    canvas.width = 360
    canvas.height = 220
    drawKeyedFrame(canvas, media, { enabled: true, color: '#00ff00', similarity: 0.28, blend: 0.08 }, false)
    const frame = canvas.toDataURL('image/webp', 0.72)
    greenThumbFrameCache.set(cacheKey, frame)
    setCachedFrame(frame)
  }

  useEffect(() => {
    setCachedFrame(greenThumbFrameCache.get(cacheKey) || '')
    const timer = window.setTimeout(draw, 120)
    return () => window.clearTimeout(timer)
  }, [asset.type, cacheKey])

  if (cachedFrame) return <img className="thumb" src={cachedFrame} alt="" loading="lazy" decoding="async" />

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
  subtitles,
  selectedItemId,
  placementPulseItemId,
  playheadFrame,
  fps,
  presetWidth,
  presetHeight,
  isPlaying,
  playbackRate,
  activeTool,
  onSelect,
  onClearSelection,
  onPatchItem,
  onItemContextMenu,
  onDropAsset,
  onCreateSubtitle
}: {
  project: ProjectFile
  items: TimelineItem[]
  audioItems: TimelineItem[]
  subtitles: TimelineItem[]
  selectedItemId: string | null
  placementPulseItemId: string | null
  playheadFrame: number
  fps: number
  presetWidth: number
  presetHeight: number
  isPlaying: boolean
  playbackRate: number
  activeTool: EditorToolId
  onSelect: (id: string) => void
  onClearSelection: () => void
  onPatchItem: PatchTimelineItem
  onItemContextMenu: (id: string, clientX: number, clientY: number) => void
  onDropAsset: (assetId: string, clientX: number, clientY: number, stage: HTMLElement) => void
  onCreateSubtitle: () => void
}): JSX.Element {
  const wheelTarget = items.find((item) => item.id === selectedItemId) || items[items.length - 1]
  const stageStyle = previewStageStyle(presetWidth, presetHeight)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [displayScale, setDisplayScale] = useState(() => fallbackPreviewDisplayScale(presetWidth, presetHeight))
  const selectedVisualItem = items.find((item) => item.id === selectedItemId) || null
  const selectedSubtitleItem = subtitles.find((item) => item.id === selectedItemId) || null
  const selectedTransform = selectedVisualItem
    ? visualTransformAtFrame(selectedVisualItem, localFrameForItem(selectedVisualItem, playheadFrame))
    : selectedSubtitleItem
      ? normalizeTransform(selectedSubtitleItem.transform)
      : null
  const wheelHistoryRef = useRef<{ itemId: string; localFrame: number; mergeKey: string; timeoutId: number | null } | null>(null)

  useEffect(() => {
    return () => {
      if (wheelHistoryRef.current?.timeoutId) window.clearTimeout(wheelHistoryRef.current.timeoutId)
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const updateScale = (): void => {
      const bounds = stage.getBoundingClientRect()
      const nextScale = previewDisplayScaleForStage(bounds.width, bounds.height, presetWidth, presetHeight)
      setDisplayScale((current) => (Math.abs(current - nextScale) > 0.001 ? nextScale : current))
    }

    updateScale()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScale)
    observer?.observe(stage)
    window.addEventListener('resize', updateScale)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [presetHeight, presetWidth])

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    const assetId = event.dataTransfer.getData('application/x-cat-meme-asset') || event.dataTransfer.getData('text/plain')
    if (assetId) onDropAsset(assetId, event.clientX, event.clientY, event.currentTarget)
  }

  return (
    <div
      ref={stageRef}
      className="quick-preview-stage"
      style={stageStyle}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={handleDrop}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('.preview-hitbox') || target.closest('.preview-text-hitbox')) return
        if (activeTool === 'text') {
          onCreateSubtitle()
          return
        }
        onClearSelection()
      }}
      onWheel={(event) => {
        if (!event.ctrlKey || !wheelTarget) return
        event.preventDefault()
        const localFrame = localFrameForItem(wheelTarget, playheadFrame)
        const transform = visualTransformAtFrame(wheelTarget, localFrame)
        const factor = event.deltaY < 0 ? 1.08 : 0.92
        let wheelHistory = wheelHistoryRef.current
        if (!wheelHistory || wheelHistory.itemId !== wheelTarget.id || wheelHistory.localFrame !== localFrame) {
          wheelHistory = {
            itemId: wheelTarget.id,
            localFrame,
            mergeKey: `preview-wheel-${wheelTarget.id}-${crypto.randomUUID()}`,
            timeoutId: null
          }
          wheelHistoryRef.current = wheelHistory
        }
        if (wheelHistory.timeoutId) window.clearTimeout(wheelHistory.timeoutId)
        // Wheel events arrive as a burst, so keep one history step until the burst settles.
        wheelHistory.timeoutId = window.setTimeout(() => {
          if (wheelHistoryRef.current?.mergeKey === wheelHistory?.mergeKey) wheelHistoryRef.current = null
        }, 420)
        onPatchItem(
          wheelTarget.id,
          patchVisualTransformAtFrame(wheelTarget, localFrame, { scale: clampNumber(transform.scale * factor, 0.08, 4) }),
          { label: '缩放素材', mergeKey: wheelHistory.mergeKey }
        )
        onSelect(wheelTarget.id)
      }}
    >
      {!items.length && (
        <div className="preview-empty">
          <Film size={38} />
          <span>把素材拖到这里，直接放进画面</span>
        </div>
      )}
      {selectedTransform && activeTool === 'select' && Math.abs(selectedTransform.x) <= presetWidth * 0.015 && <div className="preview-center-guide vertical" />}
      {selectedTransform && activeTool === 'select' && Math.abs(selectedTransform.y) <= presetHeight * 0.015 && <div className="preview-center-guide horizontal" />}
      {items.map((item) => {
        const asset = item.assetId ? project.assets.find((asset) => asset.id === item.assetId) : null
        const track = project.tracks.find((track) => track.id === item.trackId)
        if (!asset?.fileUrl) return null
        return (
          <QuickPreviewLayer
            key={item.id}
            project={project}
            item={item}
            asset={asset}
            selected={selectedItemId === item.id}
            recentlyPlaced={placementPulseItemId === item.id}
            playheadFrame={playheadFrame}
            fps={fps}
            presetWidth={presetWidth}
            presetHeight={presetHeight}
            displayScale={displayScale}
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            activeTool={activeTool}
            locked={Boolean(track?.locked)}
            onSelect={onSelect}
            onPatchItem={onPatchItem}
            onItemContextMenu={onItemContextMenu}
          />
        )
      })}
      <PreviewAudioBridge project={project} items={audioItems} visualItems={project.timeline} playheadFrame={playheadFrame} fps={fps} isPlaying={isPlaying} playbackRate={playbackRate} />
      {subtitles.map((subtitle) => (subtitle.text || (subtitle.speakerVisible && subtitle.speakerName)) && (
        <QuickPreviewTextLayer
          key={`${subtitle.id}:${subtitle.startFrame}:${subtitle.text}`}
          item={subtitle}
          project={project}
          selected={selectedItemId === subtitle.id}
          activeTool={activeTool}
          presetWidth={presetWidth}
          presetHeight={presetHeight}
          displayScale={displayScale}
          onSelect={onSelect}
          onPatchItem={onPatchItem}
          onItemContextMenu={onItemContextMenu}
        />
      ))}
    </div>
  )
}

function QuickPreviewTextLayer({
  item,
  project,
  selected,
  activeTool,
  presetWidth,
  presetHeight,
  displayScale,
  onSelect,
  onPatchItem,
  onItemContextMenu
}: {
  item: TimelineItem
  project: ProjectFile
  selected: boolean
  activeTool: EditorToolId
  presetWidth: number
  presetHeight: number
  displayScale: number
  onSelect: (id: string) => void
  onPatchItem: PatchTimelineItem
  onItemContextMenu: (id: string, clientX: number, clientY: number) => void
}): JSX.Element {
  const itemRef = useRef(item)
  const patchItemRef = useRef(onPatchItem)
  const [dragState, setDragState] = useState<{
    mode: TextHandleMode
    startX: number
    startY: number
    startTransform: NormalizedTransform
    startBox: SubtitleBox
    stageWidth: number
    stageHeight: number
    centerX: number
    centerY: number
    startDistance: number
    startAngle: number
    mergeKey: string
  } | null>(null)
  const transform = normalizeTransform(item.transform)
  const subtitleStyle = normalizeSubtitleStyle(project.subtitleStyle, item.style)
  const subtitleBox = normalizeSubtitleBox(item.subtitleBox)
  const hasText = Boolean(item.text?.trim())
  const hasSpeaker = Boolean(item.speakerVisible && item.speakerName?.trim())
  const canTransform = selected && (activeTool === 'select' || activeTool === 'text')

  useEffect(() => {
    itemRef.current = item
  }, [item])

  useEffect(() => {
    patchItemRef.current = onPatchItem
  }, [onPatchItem])

  useEffect(() => {
    if (!dragState) return
    const activeDrag = dragState
    let animationFrame: number | null = null
    let pendingPatch: Partial<TimelineItem> | null = null

    function flushPatch(): void {
      animationFrame = null
      const patch = pendingPatch
      pendingPatch = null
      if (patch) {
        patchItemRef.current(itemRef.current.id, patch, {
          label: activeDrag.mode === 'move' ? '移动字幕' : activeDrag.mode === 'rotate' ? '旋转字幕' : '缩放字幕',
          mergeKey: activeDrag.mergeKey
        })
      }
    }

    function schedulePatch(patch: Partial<TimelineItem>): void {
      pendingPatch = patch
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(flushPatch)
    }

    function onPointerMove(event: globalThis.PointerEvent): void {
      if (activeDrag.mode.startsWith('box-')) {
        const deltaXPct = ((event.clientX - activeDrag.startX) / activeDrag.stageWidth) * 100
        const deltaYPct = ((event.clientY - activeDrag.startY) / activeDrag.stageHeight) * 100
        let nextBox = activeDrag.startBox
        if (activeDrag.mode === 'box-left' || activeDrag.mode === 'box-right') {
          const direction = activeDrag.mode === 'box-left' ? -1 : 1
          nextBox = { ...nextBox, widthPct: clampNumber(activeDrag.startBox.widthPct + deltaXPct * direction * 2, 18, 96) }
        } else {
          const direction = activeDrag.mode === 'box-top' ? -1 : 1
          nextBox = {
            ...nextBox,
            autoHeight: false,
            heightPct: clampNumber((activeDrag.startBox.heightPct || 18) + deltaYPct * direction * 2, 6, 92)
          }
        }
        schedulePatch({ subtitleBox: nextBox })
        return
      }
      let nextTransform: NormalizedTransform
      if (activeDrag.mode === 'rotate') {
        const angle = (Math.atan2(event.clientY - activeDrag.centerY, event.clientX - activeDrag.centerX) * 180) / Math.PI
        const delta = angle - activeDrag.startAngle
        const rotation = event.shiftKey ? Math.round((activeDrag.startTransform.rotation + delta) / 15) * 15 : activeDrag.startTransform.rotation + delta
        nextTransform = { ...activeDrag.startTransform, rotation: Math.round(rotation) }
      } else if (activeDrag.mode.startsWith('scale')) {
        const distance = Math.hypot(event.clientX - activeDrag.centerX, event.clientY - activeDrag.centerY)
        const scaleRatio = distance / Math.max(8, activeDrag.startDistance)
        nextTransform = { ...activeDrag.startTransform, scale: clampNumber(activeDrag.startTransform.scale * scaleRatio, 0.08, 4) }
      } else {
        nextTransform = {
          ...activeDrag.startTransform,
          x: Math.round(activeDrag.startTransform.x + ((event.clientX - activeDrag.startX) / activeDrag.stageWidth) * presetWidth),
          y: Math.round(activeDrag.startTransform.y + ((event.clientY - activeDrag.startY) / activeDrag.stageHeight) * presetHeight)
        }
      }
      schedulePatch({ transform: nextTransform })
    }

    function onPointerUp(): void {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        flushPatch()
      }
      setDragState(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, presetHeight, presetWidth])

  function beginTextDrag(event: PointerEvent<HTMLElement>, mode: TextHandleMode = 'move'): void {
    event.preventDefault()
    event.stopPropagation()
    onSelect(item.id)
    if (activeTool !== 'select' && activeTool !== 'text') return
    const stage = event.currentTarget.closest<HTMLElement>('.quick-preview-stage')
    const hitbox = event.currentTarget.closest<HTMLElement>('.preview-text-hitbox')
    const stageBounds = stage?.getBoundingClientRect()
    const hitboxBounds = hitbox?.getBoundingClientRect()
    const centerX = (hitboxBounds?.left || event.clientX) + (hitboxBounds?.width || 0) / 2
    const centerY = (hitboxBounds?.top || event.clientY) + (hitboxBounds?.height || 0) / 2
    setDragState({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startTransform: transform,
      startBox: subtitleBox,
      stageWidth: stageBounds?.width || 540,
      stageHeight: stageBounds?.height || 960,
      centerX,
      centerY,
      startDistance: Math.hypot(event.clientX - centerX, event.clientY - centerY),
      startAngle: (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI,
      mergeKey: `preview-text-${item.id}-${mode}-${crypto.randomUUID()}`
    })
  }

  function renderHandles(): JSX.Element | null {
    if (!canTransform) return null
    return (
      <>
        <span className="preview-transform-center" title="拖动移动" />
        <span className="preview-transform-handle scale-nw" title="缩放" onPointerDown={(event) => beginTextDrag(event, 'scale-nw')} />
        <span className="preview-transform-handle scale-ne" title="缩放" onPointerDown={(event) => beginTextDrag(event, 'scale-ne')} />
        <span className="preview-transform-handle scale-sw" title="缩放" onPointerDown={(event) => beginTextDrag(event, 'scale-sw')} />
        <span className="preview-transform-handle scale-se" title="缩放" onPointerDown={(event) => beginTextDrag(event, 'scale-se')} />
        <span className="preview-transform-rotate" title="旋转，按 Shift 吸附 15°" onPointerDown={(event) => beginTextDrag(event, 'rotate')}>
          <RotateCcw size={13} />
        </span>
        {hasText && (
          <>
            <span className="preview-text-box-edge box-left" title="调整文本框宽度" onPointerDown={(event) => beginTextDrag(event, 'box-left')} />
            <span className="preview-text-box-edge box-right" title="调整文本框宽度" onPointerDown={(event) => beginTextDrag(event, 'box-right')} />
            <span className="preview-text-box-edge box-top" title="调整文本框高度" onPointerDown={(event) => beginTextDrag(event, 'box-top')} />
            <span className="preview-text-box-edge box-bottom" title="调整文本框高度" onPointerDown={(event) => beginTextDrag(event, 'box-bottom')} />
          </>
        )}
      </>
    )
  }

  return (
    <>
      {hasSpeaker && (
        <div className="preview-text-layer speaker-layer" style={previewTextLayerStyle('speaker', item.speakerPosition || subtitleStyle.position, transform, presetWidth, presetHeight)}>
          <div
            className={`preview-text-hitbox ${selected ? 'selected' : ''}`}
            onPointerDown={(event) => beginTextDrag(event)}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onItemContextMenu(item.id, event.clientX, event.clientY)
            }}
          >
            <div className={`preview-speaker speaker-${item.speakerPosition || subtitleStyle.position}`} style={previewSpeakerCss(subtitleStyle, displayScale)}>
              {item.speakerName}
            </div>
            {!hasText && renderHandles()}
          </div>
        </div>
      )}
      {hasText && (
        <div className="preview-text-layer subtitle-layer" style={previewSubtitleLayerStyle(subtitleStyle.position, transform, presetWidth, presetHeight, subtitleBox)}>
          <div
            className={`preview-text-hitbox ${selected ? 'selected' : ''}`}
            onPointerDown={(event) => beginTextDrag(event)}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onItemContextMenu(item.id, event.clientX, event.clientY)
            }}
          >
            <div className={`preview-subtitle subtitle-${subtitleStyle.position}`} style={previewSubtitleCss(subtitleStyle, subtitleBox, displayScale)}>
              {item.text}
            </div>
            {renderHandles()}
          </div>
        </div>
      )}
    </>
  )
}

function QuickPreviewLayer({
  project,
  item,
  asset,
  selected,
  recentlyPlaced,
  playheadFrame,
  fps,
  presetWidth,
  presetHeight,
  displayScale,
  isPlaying,
  playbackRate,
  activeTool,
  locked,
  onSelect,
  onPatchItem,
  onItemContextMenu
}: {
  project: ProjectFile
  item: TimelineItem
  asset: Asset
  selected: boolean
  recentlyPlaced: boolean
  playheadFrame: number
  fps: number
  presetWidth: number
  presetHeight: number
  displayScale: number
  isPlaying: boolean
  playbackRate: number
  activeTool: EditorToolId
  locked: boolean
  onSelect: (id: string) => void
  onPatchItem: PatchTimelineItem
  onItemContextMenu: (id: string, clientX: number, clientY: number) => void
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const itemRef = useRef(item)
  const patchItemRef = useRef(onPatchItem)
  const [dragState, setDragState] = useState<{
    mode: TransformHandleId
    startX: number
    startY: number
    localFrame: number
    startTransform: NormalizedTransform
    stageWidth: number
    stageHeight: number
    centerX: number
    centerY: number
    startDistance: number
    startAngle: number
    mergeKey: string
  } | null>(null)
  const [mediaSize, setMediaSize] = useState(() => mediaCanvasSize(asset))
  const [visibleBounds, setVisibleBounds] = useState<VisibleBounds>({ left: 0, top: 0, width: 1, height: 1 })
  const alphaVariant = greenAlphaVariant(asset)
  const mediaSrc = alphaVariant?.fileUrl || asset.fileUrl
  const mediaType = alphaVariant?.format === 'png' ? 'image' : alphaVariant?.format === 'webm' ? 'video' : asset.type
  const shouldMeasureAlpha = Boolean(alphaVariant)
  const localFrame = localFrameForItem(item, playheadFrame)
  const currentSeconds = mediaPlaybackSeconds(item, asset, localFrame, fps)
  const animationState = visualAnimationStateAtFrame(item, localFrame)
  const transform = animationState.transform
  const effectState = applyTimelineEffects(item, transform, localFrame, fps, presetWidth, presetHeight, animationState.effectIntensity)
  const keying = normalizeKeying(item.keying)
  const shouldKey = keying.enabled && !alphaVariant
  const style = {
    ...previewLayerStyle(item, asset, effectState.transform, presetWidth, presetHeight, mediaSize),
    ...(effectState.filter ? { filter: effectState.filter } : {})
  }
  const canTransform = selected && (activeTool === 'select' || activeTool === 'text') && !locked
  const roleLabel = roleLabelForItem(project, item)
  const showRoleLabel = Boolean(roleLabel.visible && roleLabel.text.trim())

  useEffect(() => {
    itemRef.current = item
  }, [item])

  useEffect(() => {
    patchItemRef.current = onPatchItem
  }, [onPatchItem])

  useEffect(() => {
    setMediaSize(mediaCanvasSize(asset))
  }, [asset.id, asset.type, asset.width, asset.height])

  useEffect(() => {
    if (!shouldKey && !shouldMeasureAlpha) setVisibleBounds({ left: 0, top: 0, width: 1, height: 1 })
  }, [shouldKey, shouldMeasureAlpha, asset.id])

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
    let animationFrame: number | null = null
    let pendingPatch: Partial<TimelineItem> | null = null

    function flushPatch(): void {
      animationFrame = null
      const patch = pendingPatch
      pendingPatch = null
      if (patch) {
        patchItemRef.current(itemRef.current.id, patch, {
          label: activeDrag.mode === 'move' ? '移动素材' : activeDrag.mode === 'rotate' ? '旋转素材' : '缩放素材',
          mergeKey: activeDrag.mergeKey
        })
      }
    }

    function schedulePatch(patch: Partial<TimelineItem>): void {
      pendingPatch = patch
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(flushPatch)
      }
    }

    function onPointerMove(event: globalThis.PointerEvent): void {
      let nextTransform: NormalizedTransform
      if (activeDrag.mode === 'rotate') {
        const angle = (Math.atan2(event.clientY - activeDrag.centerY, event.clientX - activeDrag.centerX) * 180) / Math.PI
        const delta = angle - activeDrag.startAngle
        const rotation = event.shiftKey ? Math.round((activeDrag.startTransform.rotation + delta) / 15) * 15 : activeDrag.startTransform.rotation + delta
        nextTransform = { ...activeDrag.startTransform, rotation: Math.round(rotation) }
      } else if (activeDrag.mode.startsWith('scale')) {
        const distance = Math.hypot(event.clientX - activeDrag.centerX, event.clientY - activeDrag.centerY)
        const scaleRatio = distance / Math.max(8, activeDrag.startDistance)
        nextTransform = { ...activeDrag.startTransform, scale: clampNumber(activeDrag.startTransform.scale * scaleRatio, 0.08, 4) }
      } else {
        nextTransform = {
          ...activeDrag.startTransform,
          x: Math.round(activeDrag.startTransform.x + ((event.clientX - activeDrag.startX) / activeDrag.stageWidth) * presetWidth),
          y: Math.round(activeDrag.startTransform.y + ((event.clientY - activeDrag.startY) / activeDrag.stageHeight) * presetHeight)
        }
      }
      schedulePatch(patchVisualTransformAtFrame(itemRef.current, activeDrag.localFrame, nextTransform))
    }

    function onPointerUp(): void {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        flushPatch()
      }
      setDragState(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, presetHeight, presetWidth])

  function beginStageDrag(event: PointerEvent<HTMLDivElement>): void {
    event.preventDefault()
    event.stopPropagation()
    onSelect(item.id)
    if (locked || (activeTool !== 'select' && activeTool !== 'text')) return
    const stage = event.currentTarget.closest<HTMLElement>('.quick-preview-stage')
    const bounds = stage?.getBoundingClientRect()
    setDragState({
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      localFrame,
      startTransform: transform,
      stageWidth: bounds?.width || 540,
      stageHeight: bounds?.height || 960,
      centerX: 0,
      centerY: 0,
      startDistance: 0,
      startAngle: 0,
      mergeKey: `preview-visual-${item.id}-move-${crypto.randomUUID()}`
    })
  }

  function beginTransformDrag(event: PointerEvent<HTMLElement>, mode: TransformHandleId): void {
    event.preventDefault()
    event.stopPropagation()
    onSelect(item.id)
    if (locked || (activeTool !== 'select' && activeTool !== 'text')) return
    const stage = event.currentTarget.closest<HTMLElement>('.quick-preview-stage')
    const hitbox = event.currentTarget.closest<HTMLElement>('.preview-hitbox')
    const stageBounds = stage?.getBoundingClientRect()
    const hitboxBounds = hitbox?.getBoundingClientRect()
    const centerX = (hitboxBounds?.left || event.clientX) + (hitboxBounds?.width || 0) / 2
    const centerY = (hitboxBounds?.top || event.clientY) + (hitboxBounds?.height || 0) / 2
    setDragState({
      mode,
      startX: event.clientX,
      startY: event.clientY,
      localFrame,
      startTransform: transform,
      stageWidth: stageBounds?.width || 540,
      stageHeight: stageBounds?.height || 960,
      centerX,
      centerY,
      startDistance: Math.hypot(event.clientX - centerX, event.clientY - centerY),
      startAngle: (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI,
      mergeKey: `preview-visual-${item.id}-${mode}-${crypto.randomUUID()}`
    })
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || mediaType !== 'video') return
    video.playbackRate = clampNumber(playbackRate * mediaPlaybackRateForAsset(item, asset), 0.125, 8)
    if (!isPlaying || Math.abs(video.currentTime - currentSeconds) > 0.45) {
      video.currentTime = Math.max(0, currentSeconds)
    }
    if (isPlaying) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [asset, currentSeconds, isPlaying, item, mediaType, playbackRate])

  let content: JSX.Element | null = null
  if (!mediaSrc) return <></>
  if (shouldKey && ['image', 'video', 'gif'].includes(asset.type)) {
    content = (
      <KeyedMediaCanvas
        asset={asset}
        item={item}
        currentSeconds={currentSeconds}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        measureBounds={selected || !isPlaying}
        onMediaSize={setMediaSize}
        onVisibleBounds={updateVisibleBounds}
      />
    )
  } else if (shouldMeasureAlpha && ['image', 'video', 'gif'].includes(mediaType)) {
    content = (
      <AlphaMediaCanvas
        asset={asset}
        src={mediaSrc}
        mediaType={mediaType === 'video' ? 'video' : 'image'}
        currentSeconds={currentSeconds}
        isPlaying={isPlaying}
        measureBounds={selected || !isPlaying}
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
      {showRoleLabel && (
        <div
          className="preview-role-label"
          style={previewRoleLabelPositionStyle(roleLabel.style.position, visibleBounds)}
          onPointerDown={beginStageDrag}
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onItemContextMenu(item.id, event.clientX, event.clientY)
          }}
        >
          <span style={previewRoleLabelCss(roleLabel.style, effectState.transform, displayScale)}>{roleLabel.text}</span>
        </div>
      )}
      <div
        className={`preview-hitbox ${selected ? 'selected' : ''} ${recentlyPlaced ? 'recently-placed' : ''} ${locked ? 'locked' : ''}`}
        style={visibleBoundsStyle(visibleBounds)}
        onPointerDown={beginStageDrag}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onItemContextMenu(item.id, event.clientX, event.clientY)
        }}
      >
        {canTransform && (
          <>
            <span className="preview-transform-center" title="拖动移动" />
            <span className="preview-transform-handle scale-nw" title="缩放" onPointerDown={(event) => beginTransformDrag(event, 'scale-nw')} />
            <span className="preview-transform-handle scale-ne" title="缩放" onPointerDown={(event) => beginTransformDrag(event, 'scale-ne')} />
            <span className="preview-transform-handle scale-sw" title="缩放" onPointerDown={(event) => beginTransformDrag(event, 'scale-sw')} />
            <span className="preview-transform-handle scale-se" title="缩放" onPointerDown={(event) => beginTransformDrag(event, 'scale-se')} />
            <span className="preview-transform-rotate" title="旋转，按 Shift 吸附 15°" onPointerDown={(event) => beginTransformDrag(event, 'rotate')}>
              <RotateCcw size={13} />
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function PreviewAudioBridge({
  project,
  items,
  visualItems,
  playheadFrame,
  fps,
  isPlaying,
  playbackRate
}: {
  project: ProjectFile
  items: TimelineItem[]
  visualItems: TimelineItem[]
  playheadFrame: number
  fps: number
  isPlaying: boolean
  playbackRate: number
}): JSX.Element {
  const roleAudioItems = visualItems.flatMap((item) => {
    if (!isRoleInstanceItem(item)) return []
    const track = project.tracks.find((entry) => entry.id === item.trackId)
    if (track?.muted) return []
    const localFrame = playheadFrame - item.startFrame
    const state = activeRoleStateAt(item, localFrame)
    if (!state || state.muted) return []
    const asset = project.assets.find((entry) => entry.id === state.assetId)
    if (asset?.type !== 'video') return []
    return [
      {
        ...item,
        id: `${item.id}:${state.id}:audio-preview`,
        assetId: state.assetId,
        startFrame: item.startFrame + state.startFrame,
        durationFrames: state.durationFrames,
        sourceInFrame: state.sourceInFrame || 0,
        playbackRate: state.playbackRate ?? item.playbackRate,
        volume: (item.volume ?? 1) * (state.volume ?? 1),
        roleStates: undefined
      }
    ]
  })
  const allItems = [...items, ...roleAudioItems]
  return (
    <>
      {allItems.map((item) => {
        const asset = item.assetId ? project.assets.find((asset) => asset.id === item.assetId) : null
        if (!asset?.fileUrl) return null
        const ducked =
          item.type === 'music' &&
          allItems.some((other) => other.id !== item.id && other.type !== 'music' && playheadFrame >= other.startFrame && playheadFrame < other.startFrame + other.durationFrames)
        return (
          <PreviewAudioElement
            key={item.id}
            item={item}
            asset={asset}
            playheadFrame={playheadFrame}
            fps={fps}
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            ducked={ducked}
          />
        )
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
  playbackRate,
  ducked
}: {
  item: TimelineItem
  asset: Asset
  playheadFrame: number
  fps: number
  isPlaying: boolean
  playbackRate: number
  ducked: boolean
}): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentSeconds = mediaPlaybackSeconds(item, asset, playheadFrame - item.startFrame, fps)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const fade = audioFadeMultiplier(item, playheadFrame)
    const duck = ducked ? 0.35 : 1
    audio.volume = clampNumber((item.volume ?? (item.type === 'music' ? 0.35 : 1)) * fade * duck, 0, 1)
    audio.playbackRate = clampNumber(playbackRate * mediaPlaybackRateForAsset(item, asset), 0.125, 8)
    if (Math.abs(audio.currentTime - currentSeconds) > 0.35) {
      audio.currentTime = currentSeconds
    }
    if (isPlaying) {
      void audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [asset, currentSeconds, ducked, isPlaying, item, playbackRate, playheadFrame])

  return <audio ref={audioRef} src={asset.fileUrl} preload="auto" />
}

function AlphaMediaCanvas({
  asset,
  src,
  mediaType,
  currentSeconds,
  isPlaying,
  measureBounds,
  onMediaSize,
  onVisibleBounds
}: {
  asset: Asset
  src: string
  mediaType: 'image' | 'video'
  currentSeconds: number
  isPlaying: boolean
  measureBounds: boolean
  onMediaSize: (size: { width: number; height: number }) => void
  onVisibleBounds: (bounds: VisibleBounds) => void
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [canvasSize, setCanvasSize] = useState(() => mediaCanvasSize(asset))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const media = mediaType === 'video' ? videoRef.current : imageRef.current
    if (!canvas || !media || !mediaReady(media)) return
    const bounds = drawAlphaFrame(canvas, media, measureBounds)
    if (measureBounds) {
      onVisibleBounds(
        bounds && isUsefulForegroundBounds(bounds, { minWidth: 0.006, minHeight: 0.006, minArea: 0.00008 }) ? bounds : { left: 0, top: 0, width: 1, height: 1 }
      )
    }
  }, [mediaType, measureBounds, onVisibleBounds])

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
  }, [currentSeconds, isPlaying, mediaType, src])

  useEffect(() => {
    let frame = 0
    let stopped = false

    function drawFrame(): void {
      if (stopped) return
      draw()
      if (mediaType === 'video' && isPlaying) {
        frame = window.requestAnimationFrame(drawFrame)
      }
    }

    drawFrame()
    return () => {
      stopped = true
      window.cancelAnimationFrame(frame)
    }
  }, [canvasSize.height, canvasSize.width, currentSeconds, draw, isPlaying, mediaType, src])

  return (
    <>
      {mediaType === 'video' ? (
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          className="key-source"
          onLoadedMetadata={(event) => {
            const size = mediaElementSize(event.currentTarget)
            setCanvasSize(size)
            onMediaSize(size)
          }}
          onSeeked={draw}
        />
      ) : (
        <img
          ref={imageRef}
          src={src}
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

function KeyedMediaCanvas({
  asset,
  item,
  currentSeconds,
  isPlaying,
  playbackRate,
  measureBounds,
  onMediaSize,
  onVisibleBounds
}: {
  asset: Asset
  item: TimelineItem
  currentSeconds: number
  isPlaying: boolean
  playbackRate: number
  measureBounds: boolean
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
    video.playbackRate = clampNumber(playbackRate * mediaPlaybackRateForAsset(item, asset), 0.125, 8)
    if (!isPlaying || Math.abs(video.currentTime - currentSeconds) > 0.45) {
      video.currentTime = Math.max(0, currentSeconds)
    }
    if (isPlaying) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [asset, currentSeconds, isPlaying, item, playbackRate])

  useEffect(() => {
    let frame = 0
    let stopped = false

    function draw(): void {
      if (stopped) return
      const canvas = canvasRef.current
      const media = asset.type === 'video' ? videoRef.current : imageRef.current
      if (canvas && media && mediaReady(media)) {
        const bounds = drawKeyedFrame(canvas, media, keying, measureBounds)
        if (measureBounds) {
          onVisibleBounds(bounds && isUsefulForegroundBounds(bounds) ? bounds : { left: 0, top: 0, width: 1, height: 1 })
        }
      }
      if (asset.type === 'video' && isPlaying) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    draw()
    return () => {
      stopped = true
      window.cancelAnimationFrame(frame)
    }
  }, [asset.type, currentSeconds, isPlaying, keying.blend, keying.color, keying.enabled, keying.similarity, measureBounds, onVisibleBounds])

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
  selectedCue,
  selectedKeyframe,
  playheadFrame,
  lastExport,
  availableAssets,
  onPatchTrack,
  onPatchItem,
  onCreateSubtitleStream,
  onSelectCue,
  onAddRoleCue,
  onProjectDurationChange,
  onSelectKeyframe,
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
  selectedCue: SelectedCueRef | null
  selectedKeyframe: { itemId: string; keyframeId: string } | null
  playheadFrame: number
  lastExport: RenderResult | null
  availableAssets: Asset[]
  onPatchTrack: (trackId: string, patch: Partial<TimelineTrack>) => void
  onPatchItem: (patch: Partial<TimelineItem>) => void
  onCreateSubtitleStream: (trackId: string) => void
  onSelectCue: (itemId: string, cueId: string, kind: SelectedCueRef['kind'], absoluteFrame?: number) => void
  onAddRoleCue: (itemId: string, assetId: string, replaceCueId?: string) => void
  onProjectDurationChange: (seconds: number) => void
  onSelectKeyframe: (itemId: string, keyframeId: string, absoluteFrame: number) => void
  onSeek: (frame: number) => void
  onSplit: () => void
  onDelete: () => void
}): JSX.Element {
  return (
    <div className="property-inspector">
      <TrackInspector project={project} track={selectedTrack} onPatchTrack={onPatchTrack} onCreateSubtitleStream={onCreateSubtitleStream} />
      <div className="property-section">
        {selectedItem ? (
          <SelectedInspector
            project={project}
            item={selectedItem}
            fps={fps}
            playheadFrame={playheadFrame}
            selectedCue={selectedCue?.itemId === selectedItem.id ? selectedCue : null}
            selectedKeyframeId={selectedKeyframe?.itemId === selectedItem.id ? selectedKeyframe.keyframeId : null}
            availableAssets={availableAssets}
            onPatch={onPatchItem}
            onSelectCue={(cueId, kind, frame) => onSelectCue(selectedItem.id, cueId, kind, frame)}
            onAddRoleCue={(assetId, replaceCueId) => onAddRoleCue(selectedItem.id, assetId, replaceCueId)}
            onSelectKeyframe={(keyframeId, frame) => onSelectKeyframe(selectedItem.id, keyframeId, selectedItem.startFrame + frame)}
            onSeek={onSeek}
            onSplit={onSplit}
            onDelete={onDelete}
          />
        ) : (
          <ProjectOverviewInspector project={project} preset={preset} totalFrames={totalFrames} fps={fps} lastExport={lastExport} onDurationChange={onProjectDurationChange} />
        )}
      </div>
    </div>
  )
}

function TrackInspector({
  project,
  track,
  onPatchTrack,
  onCreateSubtitleStream
}: {
  project: ProjectFile
  track: TimelineTrack | null
  onPatchTrack: (trackId: string, patch: Partial<TimelineTrack>) => void
  onCreateSubtitleStream: (trackId: string) => void
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
  const itemCount = project.timeline.filter((item) => item.trackId === track.id && isTimelineCountItem(item)).length
  const outputLabel = track.kind === 'visual' || track.kind === 'subtitle' ? '画面输出' : '声音输出'
  const groupOptions = TRACK_GROUPS.filter((option) => canMoveTrackToGroup(track, option.id))
  const hasSubtitleStream = track.kind === 'subtitle' && project.timeline.some((item) => item.trackId === track.id && isSubtitleStreamItem(item))

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
      <p className="muted small-note">下方视觉轨会盖在上方。</p>
      {track.kind === 'subtitle' && !hasSubtitleStream && (
        <button className="command ghost wide" onClick={() => onCreateSubtitleStream(track.id)}>
          <Plus size={15} />
          创建字幕流
        </button>
      )}
    </section>
  )
}

function SelectedInspector({
  project,
  item,
  fps,
  playheadFrame,
  selectedCue,
  selectedKeyframeId,
  availableAssets,
  onPatch,
  onSelectCue,
  onAddRoleCue,
  onSelectKeyframe,
  onSeek,
  onSplit,
  onDelete
}: {
  project: ProjectFile
  item: TimelineItem | null
  fps: number
  playheadFrame: number
  selectedCue: SelectedCueRef | null
  selectedKeyframeId: string | null
  availableAssets: Asset[]
  onPatch: (patch: Partial<TimelineItem>) => void
  onSelectCue: (cueId: string, kind: SelectedCueRef['kind'], absoluteFrame?: number) => void
  onAddRoleCue: (assetId: string, replaceCueId?: string) => void
  onSelectKeyframe: (keyframeId: string, frame: number) => void
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
  const canRateStretch = isRateStretchItem(item, project.assets)
  const itemAsset = item.assetId ? project.assets.find((asset) => asset.id === item.assetId) || null : null
  const hasAudioControls = Boolean(itemAsset && canUseAsAudioAsset(itemAsset))
  const effectDisabled = effect.type === 'none'
  const patchEffectIntensity = (value: number): void => {
    const intensity = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
    onPatch({ effects: [{ ...effect, intensity }] })
  }
  return (
    <section className="inspector">
      <PanelTitle icon={<SlidersHorizontal />} title="片段" />
      <label className="field compact">
        <span>名称</span>
        <input value={item.label} onChange={(event) => onPatch({ label: event.target.value })} />
      </label>
      <div className="number-grid">
        <NumberField label="起始帧" value={item.startFrame} onChange={(value) => onPatch({ startFrame: value })} />
        <NumberField label="显示时长帧" value={item.durationFrames} onChange={(value) => onPatch({ durationFrames: Math.max(1, value) })} />
        <NumberField label="入点帧" value={item.sourceInFrame} onChange={(value) => onPatch({ sourceInFrame: Math.max(0, value) })} />
        {canRateStretch && (
          <label className="field compact">
            <span>变速</span>
            <input
              type="number"
              min={MIN_PLAYBACK_RATE}
              max={MAX_PLAYBACK_RATE}
              step={0.05}
              value={itemPlaybackRate(item)}
              onChange={(event) => onPatch({ playbackRate: clampNumber(Number(event.target.value) || 1, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE) })}
            />
          </label>
        )}
        <NumberField label="音量" value={Math.round((item.volume ?? 1) * 100)} onChange={(value) => onPatch({ volume: value / 100 })} />
      </div>
      {item.type !== 'subtitle' && (
        <button className={item.loop ? 'loop-toggle active' : 'loop-toggle'} onClick={() => onPatch({ loop: !item.loop })}>
          <Repeat2 size={14} />
          {item.loop ? '循环播放已开启' : '循环播放关闭'}
        </button>
      )}
      {hasAudioControls && itemAsset && <AudioDetailInspector item={item} asset={itemAsset} fps={fps} onPatch={onPatch} />}
      {item.type === 'subtitle' && (
        isSubtitleStreamItem(item) ? (
          <SubtitleStreamInspector project={project} item={item} fps={fps} playheadFrame={playheadFrame} selectedCueId={selectedCue?.kind === 'subtitle' ? selectedCue.cueId : null} onSelectCue={(cueId, frame) => onSelectCue(cueId, 'subtitle', frame)} onPatch={onPatch} />
        ) : (
          <DialogueInspector item={item} onPatch={onPatch} />
        )
      )}
      {item.type === 'visual' && (
        <>
          {isRoleInstanceItem(item) && <RoleInstanceInspector project={project} item={item} availableAssets={availableAssets} fps={fps} playheadFrame={playheadFrame} selectedCueId={selectedCue?.kind === 'role' ? selectedCue.cueId : null} onSelectCue={(cueId, frame) => onSelectCue(cueId, 'role', frame)} onAddRoleCue={onAddRoleCue} onPatch={onPatch} />}
          <div className="effect-editor">
            <div className="effect-header">
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
              <label className="field compact">
                <span>强度</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={effectDisabled}
                  value={effect.intensity}
                  onChange={(event) => patchEffectIntensity(Number(event.target.value))}
                />
              </label>
            </div>
            <input
              className="effect-intensity-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              disabled={effectDisabled}
              value={effect.intensity}
              aria-label="效果强度"
              onChange={(event) => patchEffectIntensity(Number(event.target.value))}
            />
            <InspectorHint>{effectHint(effect.type)}</InspectorHint>
          </div>
          <RoleLabelInspector project={project} item={item} onPatch={onPatch} />
          <VisualKeyframeEditor
            item={item}
            fps={fps}
            playheadFrame={playheadFrame}
            selectedKeyframeId={selectedKeyframeId}
            onPatch={onPatch}
            onSelectKeyframe={onSelectKeyframe}
            onSeek={onSeek}
          />
          <VisualTransformEditor item={item} playheadFrame={playheadFrame} onPatch={onPatch} />
          <VisualKeyingEditor item={item} onPatch={onPatch} />
        </>
      )}
      <div className="two-buttons">
        {!isSubtitleStreamItem(item) && (
          <button className="command" onClick={onSplit}>
            <Scissors size={16} />
            拆分
          </button>
        )}
        <button className="command danger" onClick={onDelete}>
          <Trash2 size={16} />
          删除
        </button>
      </div>
      <small className="muted">{formatTime(item.startFrame, fps)} - {formatTime(item.startFrame + item.durationFrames, fps)}</small>
    </section>
  )
}

function AudioDetailInspector({
  item,
  asset,
  fps,
  onPatch
}: {
  item: TimelineItem
  asset: Asset
  fps: number
  onPatch: (patch: Partial<TimelineItem>) => void
}): JSX.Element {
  const [waveform, setWaveform] = useState<WaveformData | null>(null)

  useEffect(() => {
    let cancelled = false
    setWaveform(null)
    void window.catMeme.getAssetWaveform(asset.id).then((data) => {
      if (!cancelled) setWaveform(data)
    }).catch(() => {
      if (!cancelled) setWaveform(emptyWaveformData(asset.id))
    })
    return () => {
      cancelled = true
    }
  }, [asset.id])

  const peakPercent = Math.round((waveform?.peak || 0) * 100)
  const meanPercent = Math.round((waveform?.mean || 0) * 100)

  return (
    <div className="audio-detail-card">
      <div className="audio-detail-head">
        <strong>音频精修</strong>
        <span>{peakPercent ? `峰值 ${peakPercent}% · 均值 ${meanPercent}%` : '等待波形'}</span>
      </div>
      <WaveformPreview waveform={waveform} />
      <div className="number-grid">
        <NumberField label="淡入帧" value={item.fadeInFrames || 0} onChange={(value) => onPatch({ fadeInFrames: Math.max(0, value) })} />
        <NumberField label="淡出帧" value={item.fadeOutFrames || 0} onChange={(value) => onPatch({ fadeOutFrames: Math.max(0, value) })} />
      </div>
      <InspectorHint>
        {item.type === 'music'
          ? 'BGM 遇到配音、音效或视频原声时会在预览和导出中自动压低到 35%。'
          : `淡入淡出会按 ${fps}fps 同步到预览和导出。`}
      </InspectorHint>
    </div>
  )
}

function WaveformPreview({ waveform }: { waveform: WaveformData | null }): JSX.Element {
  const samples = waveform?.samples || []
  if (!samples.length) {
    return (
      <div className="waveform-preview empty">
        <span />
      </div>
    )
  }
  return (
    <div className="waveform-preview" title="音频波形">
      {samples.map((sample, index) => (
        <span key={index} style={{ height: `${Math.max(8, Math.round(sample * 100))}%` }} />
      ))}
    </div>
  )
}

function ProjectOverviewInspector({
  project,
  preset,
  totalFrames,
  fps,
  lastExport,
  onDurationChange
}: {
  project: ProjectFile
  preset: ExportPreset
  totalFrames: number
  fps: number
  lastExport: RenderResult | null
  onDurationChange: (seconds: number) => void
}): JSX.Element {
  const timelineAssetIds = new Set(project.timeline.map((item) => item.assetId).filter(Boolean))
  const projectAssetIds = new Set(project.assets.map((asset) => asset.id))
  const missingCount = [...timelineAssetIds].filter((assetId) => !projectAssetIds.has(String(assetId))).length
  const visualCount = project.timeline.filter((item) => item.type === 'visual').length
  const subtitleCount = project.timeline.filter((item) => item.type === 'subtitle' && isTimelineCountItem(item)).length
  const audioCount = project.timeline.filter((item) => ['voice', 'music', 'sfx'].includes(item.type)).length
  const mutedTracks = project.tracks.filter((track) => track.muted).length
  const minimumSeconds = Math.max(1, Math.ceil(projectContentEndFrame(project) / fps))

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
      <label className="field compact">
        <span>工程总时长（秒）</span>
        <input
          type="number"
          min={minimumSeconds}
          step={1}
          value={Math.round(totalFrames / fps)}
          onChange={(event) => onDurationChange(Number(event.target.value) || minimumSeconds)}
        />
      </label>
      <div className={missingCount ? 'quality-card warning' : 'quality-card ok'}>
        <strong>{missingCount ? '需要处理' : '状态良好'}</strong>
        <span>{missingCount ? `有 ${missingCount} 个时间线素材未找到` : '时间线素材完整，可以继续剪辑或导出。'}</span>
      </div>
      <div className="overview-rules">
        <span>背景置底，播放头即素材首帧。</span>
        <span>角色绿幕保留原比例。</span>
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
  selectedCue,
  selectedKeyframe,
  selectedTrackId,
  playheadFrame,
  activeGroup,
  soloGroup,
  onSelect,
  onSelectKeyframe,
  onMoveKeyframe,
  onSelectTrack,
  onSeek,
  onPatchItem,
  onPatchTrack,
  onPatchGroup,
  onSelectCue,
  onMoveCueToTrack,
  onCreateSubtitleStream,
  onCreateRoleStream,
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
  onDropAsset,
  onDropAssetToDefaultTrack
}: {
  project: ProjectFile
  availableAssets: Asset[]
  totalFrames: number
  fps: number
  selectedItemId: string | null
  selectedCue: SelectedCueRef | null
  selectedKeyframe: { itemId: string; keyframeId: string } | null
  selectedTrackId: string | null
  playheadFrame: number
  activeGroup: TrackGroupFilter
  soloGroup: TrackGroupId | null
  onSelect: (id: string) => void
  onSelectKeyframe: (itemId: string, keyframeId: string, absoluteFrame: number) => void
  onMoveKeyframe: (itemId: string, keyframeId: string, localFrame: number) => void
  onSelectTrack: (trackId: string, clearItem?: boolean) => void
  onSeek: (frame: number) => void
  onPatchItem: PatchTimelineItem
  onPatchTrack: (trackId: string, patch: Partial<TimelineTrack>) => void
  onPatchGroup: (groupId: TrackGroupId, patch: Partial<TimelineTrack>) => void
  onSelectCue: (itemId: string, cueId: string, kind: SelectedCueRef['kind'], absoluteFrame?: number) => void
  onMoveCueToTrack: (args: { itemId: string; cueId: string; kind: 'subtitle' | 'role'; targetTrackId: string; absoluteFrame: number }) => boolean
  onCreateSubtitleStream: (trackId: string) => void
  onCreateRoleStream: (trackId: string) => TimelineItem | null
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
  onDropAsset: (assetId: string, trackId: string, frame: number) => boolean
  onDropAssetToDefaultTrack: (assetId: string, frame: number) => boolean
}): JSX.Element {
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'rate-start' | 'rate-end'
    item: TimelineItem
    startX: number
    startFrame: number
    durationFrames: number
    sourceInFrame: number
    laneWidth: number
    mergeKey: string
  } | null>(null)
  const [keyframeDrag, setKeyframeDrag] = useState<{
    item: TimelineItem
    keyframeId: string
    startX: number
    startFrame: number
    laneWidth: number
  } | null>(null)
  const [cueDrag, setCueDrag] = useState<{
    kind: 'subtitle' | 'role'
    item: TimelineItem
    cueId: string
    mode: 'move' | 'start' | 'end'
    startX: number
    startFrame: number
    durationFrames: number
    laneWidth: number
    mergeKey: string
  } | null>(null)
  const [cueDropPreview, setCueDropPreview] = useState<{
    kind: 'subtitle' | 'role'
    itemId: string
    cueId: string
    trackId: string
    frame: number
    durationFrames: number
    valid: boolean
  } | null>(null)
  const cueDropPreviewRef = useRef<typeof cueDropPreview>(null)
  const [durationDrag, setDurationDrag] = useState<{ startX: number; startFrames: number; laneWidth: number } | null>(null)
  const [trackDropTarget, setTrackDropTarget] = useState<string | null>(null)
  const [assetDropPreview, setAssetDropPreview] = useState<{
    trackId: string
    frame: number
    durationFrames: number
    valid: boolean
    label?: string
  } | null>(null)
  const projectRef = useRef(project)
  const patchItemRef = useRef(onPatchItem)
  const moveKeyframeRef = useRef(onMoveKeyframe)
  const rulerTicks = useMemo(() => makeRulerTicks(totalFrames, fps), [fps, totalFrames])
  const visibleGroups = activeGroup === 'all' ? TRACK_GROUPS : TRACK_GROUPS.filter((group) => group.id === activeGroup)

  useEffect(() => {
    projectRef.current = project
  }, [project])

  useEffect(() => {
    patchItemRef.current = onPatchItem
  }, [onPatchItem])

  useEffect(() => {
    moveKeyframeRef.current = onMoveKeyframe
  }, [onMoveKeyframe])

  useEffect(() => {
    if (!dragState) return
    const activeDrag = dragState
    let animationFrame: number | null = null
    let pendingPatch: Partial<TimelineItem> | null = null

    function flushPatch(): void {
      animationFrame = null
      const patch = pendingPatch
      pendingPatch = null
      if (patch) {
        patchItemRef.current(activeDrag.item.id, patch, {
          label: activeDrag.mode === 'move' ? '移动片段' : '裁剪片段',
          mergeKey: activeDrag.mergeKey
        })
      }
    }

    function schedulePatch(patch: Partial<TimelineItem>): void {
      pendingPatch = patch
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(flushPatch)
      }
    }

    function onPointerMove(event: globalThis.PointerEvent): void {
      const deltaFrames = Math.round(((event.clientX - activeDrag.startX) / activeDrag.laneWidth) * totalFrames)
      let patch: Partial<TimelineItem>
      const currentProject = projectRef.current

      if (activeDrag.mode === 'move') {
        const lane = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-track-id]')
        const trackId = lane?.dataset.trackId
        patch = {
          startFrame: Math.max(0, activeDrag.startFrame + deltaFrames),
          ...(trackId && canMoveItemToTrack(currentProject, activeDrag.item, trackId) ? { trackId } : {})
        }
      } else if (activeDrag.mode === 'rate-start') {
        const rightEdge = activeDrag.startFrame + activeDrag.durationFrames
        const startFrame = clampNumber(activeDrag.startFrame + deltaFrames, 0, rightEdge - 1)
        patch = buildRateStretchPatch(activeDrag.item, availableAssets, activeDrag.startFrame, activeDrag.durationFrames, startFrame, rightEdge - startFrame, 'start')
      } else {
        patch = buildRateStretchPatch(activeDrag.item, availableAssets, activeDrag.startFrame, activeDrag.durationFrames, activeDrag.startFrame, activeDrag.durationFrames + deltaFrames, 'end')
      }

      if (snapEnabled && !event.altKey) {
        patch = snapTimelinePatch({
          project: currentProject,
          item: activeDrag.item,
          mode: activeDrag.mode,
          patch,
          startFrame: activeDrag.startFrame,
          durationFrames: activeDrag.durationFrames,
          trackId: patch.trackId || activeDrag.item.trackId,
          playheadFrame,
          rulerFrames: rulerTicks.map((tick) => tick.frame),
          thresholdFrames: snapThresholdFrames(activeDrag.laneWidth, totalFrames, fps)
        })
      }

      if (activeDrag.mode !== 'move') {
        patch = buildRateStretchPatch(
          activeDrag.item,
          availableAssets,
          activeDrag.startFrame,
          activeDrag.durationFrames,
          patch.startFrame ?? activeDrag.startFrame,
          patch.durationFrames ?? activeDrag.durationFrames,
          activeDrag.mode === 'rate-start' ? 'start' : 'end'
        )
      }

      schedulePatch(patch)
    }

    function onPointerUp(): void {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        flushPatch()
      }
      setDragState(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [availableAssets, dragState, fps, playheadFrame, rulerTicks, snapEnabled, totalFrames])

  useEffect(() => {
    if (!keyframeDrag) return
    const activeDrag = keyframeDrag
    let animationFrame: number | null = null
    let pendingFrame: number | null = null

    function flushMove(): void {
      animationFrame = null
      const frame = pendingFrame
      pendingFrame = null
      if (frame !== null) moveKeyframeRef.current(activeDrag.item.id, activeDrag.keyframeId, frame)
    }

    function scheduleMove(frame: number): void {
      pendingFrame = frame
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(flushMove)
      }
    }

    function onPointerMove(event: globalThis.PointerEvent): void {
      const deltaFrames = Math.round(((event.clientX - activeDrag.startX) / Math.max(1, activeDrag.laneWidth)) * totalFrames)
      scheduleMove(clampNumber(activeDrag.startFrame + deltaFrames, 0, Math.max(0, activeDrag.item.durationFrames - 1)))
    }

    function onPointerUp(): void {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        flushMove()
      }
      setKeyframeDrag(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [keyframeDrag, totalFrames])

  useEffect(() => {
    if (!cueDrag) return
    const activeDrag = cueDrag
    let animationFrame: number | null = null
    let pendingPatch: Partial<TimelineItem> | null = null

    function cuePatch(deltaFrames: number, event: globalThis.PointerEvent): Partial<TimelineItem> {
      const rawStart =
        activeDrag.mode === 'move' || activeDrag.mode === 'start'
          ? clampNumber(activeDrag.startFrame + deltaFrames, 0, Math.max(0, activeDrag.item.durationFrames - 1))
          : activeDrag.startFrame
      const rawDuration =
        activeDrag.mode === 'start'
          ? Math.max(1, activeDrag.startFrame + activeDrag.durationFrames - rawStart)
          : activeDrag.mode === 'end'
            ? Math.max(1, activeDrag.durationFrames + deltaFrames)
            : activeDrag.durationFrames
      const { startFrame: nextStart, durationFrames: nextDuration } = snapCueDragPatch(activeDrag, rawStart, rawDuration, event)
      if (activeDrag.kind === 'subtitle') {
        const cues = normalizeSubtitleCues(activeDrag.item.subtitleCues, activeDrag.item.durationFrames).map((cue) =>
          cue.id === activeDrag.cueId ? { ...cue, startFrame: nextStart, durationFrames: Math.min(nextDuration, activeDrag.item.durationFrames - nextStart) } : cue
        )
        return { subtitleCues: normalizeSubtitleCues(cues, activeDrag.item.durationFrames) }
      }
      const states = normalizeRoleStates(activeDrag.item.roleStates, activeDrag.item.durationFrames).map((state) =>
        state.id === activeDrag.cueId ? { ...state, startFrame: nextStart, durationFrames: Math.min(nextDuration, activeDrag.item.durationFrames - nextStart) } : state
      )
      return { roleStates: resolveRoleStateOverlaps(states, activeDrag.cueId, activeDrag.item.durationFrames) }
    }

    function flushPatch(): void {
      animationFrame = null
      const patch = pendingPatch
      pendingPatch = null
      if (patch) patchItemRef.current(activeDrag.item.id, patch, { label: activeDrag.kind === 'subtitle' ? '调整字幕 cue' : '调整角色状态', mergeKey: activeDrag.mergeKey })
    }

    function schedulePatch(patch: Partial<TimelineItem>): void {
      pendingPatch = patch
      if (animationFrame === null) animationFrame = window.requestAnimationFrame(flushPatch)
    }

    function onPointerMove(event: globalThis.PointerEvent): void {
      const deltaFrames = Math.round(((event.clientX - activeDrag.startX) / Math.max(1, activeDrag.laneWidth)) * totalFrames)
      if (activeDrag.mode === 'move') {
        const lane = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-track-id]')
        const targetTrackId = lane?.dataset.trackId
        const targetTrack = targetTrackId ? projectRef.current.tracks.find((track) => track.id === targetTrackId) : undefined
        const targetAcceptsCue =
          targetTrack &&
          !targetTrack.locked &&
          targetTrack.id !== activeDrag.item.trackId &&
          (activeDrag.kind === 'subtitle'
            ? targetTrack.kind === 'subtitle'
            : targetTrack.kind === 'visual' && trackGroupId(targetTrack) === 'role')
        if (targetAcceptsCue) {
          const nextStart = clampNumber(activeDrag.startFrame + deltaFrames, 0, Math.max(0, activeDrag.item.durationFrames - activeDrag.durationFrames))
          const preview = {
            kind: activeDrag.kind,
            itemId: activeDrag.item.id,
            cueId: activeDrag.cueId,
            trackId: targetTrack.id,
            frame: activeDrag.item.startFrame + nextStart,
            durationFrames: activeDrag.durationFrames,
            valid: true
          }
          cueDropPreviewRef.current = preview
          setCueDropPreview(preview)
          return
        }
      }
      cueDropPreviewRef.current = null
      setCueDropPreview(null)
      schedulePatch(cuePatch(deltaFrames, event))
    }

    function onPointerUp(): void {
      const dropPreview = cueDropPreviewRef.current
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        if (!dropPreview?.valid) flushPatch()
      }
      if (dropPreview?.valid) {
        onMoveCueToTrack({
          itemId: activeDrag.item.id,
          cueId: activeDrag.cueId,
          kind: activeDrag.kind,
          targetTrackId: dropPreview.trackId,
          absoluteFrame: dropPreview.frame
        })
      }
      setCueDrag(null)
      cueDropPreviewRef.current = null
      setCueDropPreview(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [cueDrag, onMoveCueToTrack, totalFrames])

  useEffect(() => {
    if (!durationDrag) return
    const activeDrag = durationDrag

    function onPointerMove(event: globalThis.PointerEvent): void {
      const deltaFrames = Math.round(((event.clientX - activeDrag.startX) / Math.max(1, activeDrag.laneWidth)) * totalFrames)
      onTotalFramesChange(Math.max(fps, activeDrag.startFrames + deltaFrames))
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

  function isTimelineBlankDropTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && !target.closest('.track-lane, .track-label, .timeline-item, .track-group-controls')
  }

  function frameFromTimelineDrop(element: HTMLElement, clientX: number): number {
    const rulerLane = element.querySelector<HTMLElement>('.ruler-lane')
    return frameFromClientX(rulerLane || element, clientX)
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

  function handleAssetTrackLabelDragOver(event: DragEvent<HTMLDivElement>, track: TimelineTrack): void {
    if (dragHasType(event, TRACK_DRAG_MIME)) return
    const assetId = assetIdFromDrag(event)
    if (!assetId) return
    const asset = availableAssets.find((item) => item.id === assetId)
    if (!asset) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = track.locked || !canDropAssetOnTimelineTrack(project, asset, track) ? 'none' : 'copy'
    setTrackDropTarget(track.id)
  }

  function handleAssetTrackLabelDrop(event: DragEvent<HTMLDivElement>, track: TimelineTrack): void {
    if (dragHasType(event, TRACK_DRAG_MIME)) return
    event.preventDefault()
    event.stopPropagation()
    const assetId = assetIdFromDrag(event)
    if (assetId) onDropAsset(assetId, track.id, playheadFrame)
    setTrackDropTarget(null)
  }

  function handleAssetDrop(event: DragEvent<HTMLDivElement>, trackId: string): void {
    event.preventDefault()
    event.stopPropagation()
    const assetId = assetIdFromDrag(event)
    if (!assetId) return
    const asset = availableAssets.find((item) => item.id === assetId)
    if (!asset) {
      setAssetDropPreview(null)
      return
    }
    const frame = assetDropPreview?.trackId === trackId ? assetDropPreview.frame : frameFromClientX(event.currentTarget, event.clientX)
    onDropAsset(assetId, trackId, frame)
    setAssetDropPreview(null)
  }

  function handleTimelineBlankDragOver(event: DragEvent<HTMLDivElement>): void {
    if (dragHasType(event, TRACK_DRAG_MIME) || !isTimelineBlankDropTarget(event.target)) return
    const assetId = assetIdFromDrag(event)
    if (!assetId || !availableAssets.some((item) => item.id === assetId)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleTimelineBlankDrop(event: DragEvent<HTMLDivElement>): void {
    if (dragHasType(event, TRACK_DRAG_MIME) || !isTimelineBlankDropTarget(event.target)) return
    event.preventDefault()
    const assetId = assetIdFromDrag(event)
    if (!assetId) return
    onDropAssetToDefaultTrack(assetId, frameFromTimelineDrop(event.currentTarget, event.clientX))
    setAssetDropPreview(null)
  }

  function beginDrag(event: PointerEvent<HTMLElement>, item: TimelineItem, mode: 'move' | 'rate-start' | 'rate-end'): void {
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
      mergeKey: `timeline-${item.id}-${mode}-${crypto.randomUUID()}`
    })
    onSelect(item.id)
  }

  function beginKeyframeDrag(event: PointerEvent<HTMLElement>, item: TimelineItem, keyframe: VisualKeyframe): void {
    event.preventDefault()
    event.stopPropagation()
    const track = project.tracks.find((track) => track.id === item.trackId)
    if (track?.locked) return
    const lane = event.currentTarget.closest<HTMLElement>('.track-lane')
    onSelectKeyframe(item.id, keyframe.id, item.startFrame + keyframe.frame)
    setKeyframeDrag({
      item,
      keyframeId: keyframe.id,
      startX: event.clientX,
      startFrame: keyframe.frame,
      laneWidth: lane?.getBoundingClientRect().width || 960
    })
  }

  function beginCueDrag(
    event: PointerEvent<HTMLElement>,
    item: TimelineItem,
    cue: SubtitleCue | RoleStateCue,
    kind: 'subtitle' | 'role',
    mode: 'move' | 'start' | 'end'
  ): void {
    event.preventDefault()
    event.stopPropagation()
    const track = project.tracks.find((track) => track.id === item.trackId)
    if (track?.locked) return
    const lane = event.currentTarget.closest<HTMLElement>('.track-lane')
    setCueDrag({
      kind,
      item,
      cueId: cue.id,
      mode,
      startX: event.clientX,
      startFrame: cue.startFrame,
      durationFrames: cue.durationFrames,
      laneWidth: lane?.getBoundingClientRect().width || 960,
      mergeKey: `timeline-cue-${item.id}-${cue.id}-${mode}-${crypto.randomUUID()}`
    })
    onSelect(item.id)
    onSelectCue(item.id, cue.id, kind, item.startFrame + cue.startFrame)
    onSeek(item.startFrame + cue.startFrame)
  }

  function cueEntriesForItem(item: TimelineItem): Array<{ id: string; startFrame: number; durationFrames: number }> {
    if (isSubtitleStreamItem(item)) return normalizeSubtitleCues(item.subtitleCues, item.durationFrames)
    if (isRoleInstanceItem(item)) return normalizeRoleStates(item.roleStates, item.durationFrames)
    return []
  }

  function snapCueDragPatch(
    activeDrag: NonNullable<typeof cueDrag>,
    rawStartFrame: number,
    rawDurationFrames: number,
    event: globalThis.PointerEvent
  ): { startFrame: number; durationFrames: number } {
    let startFrame = clampNumber(Math.round(rawStartFrame), 0, Math.max(0, activeDrag.item.durationFrames - 1))
    let durationFrames = clampNumber(Math.round(rawDurationFrames), 1, Math.max(1, activeDrag.item.durationFrames - startFrame))
    if (!snapEnabled || event.altKey) return { startFrame, durationFrames }

    const entries = cueEntriesForItem(activeDrag.item).filter((entry) => entry.id !== activeDrag.cueId)
    const threshold = Math.max(
      snapThresholdFrames(activeDrag.laneWidth, totalFrames, fps),
      event.shiftKey && activeDrag.mode === 'move' ? Math.round(fps * 0.18) : 0
    )

    if (activeDrag.mode === 'move' && event.shiftKey) {
      const stickyStarts = entries.flatMap((entry) => [entry.startFrame + entry.durationFrames, entry.startFrame - durationFrames])
      const snappedStart = nearestCueSnap(startFrame, stickyStarts, threshold)
      return {
        startFrame: clampNumber(snappedStart ?? startFrame, 0, Math.max(0, activeDrag.item.durationFrames - durationFrames)),
        durationFrames
      }
    }

    const localPlayhead = clampNumber(playheadFrame - activeDrag.item.startFrame, 0, activeDrag.item.durationFrames)
    const candidates = uniqueNumbers([
      0,
      activeDrag.item.durationFrames,
      localPlayhead,
      ...rulerTicks
        .map((tick) => tick.frame - activeDrag.item.startFrame)
        .filter((frame) => frame >= 0 && frame <= activeDrag.item.durationFrames),
      ...entries.flatMap((entry) => [entry.startFrame, entry.startFrame + entry.durationFrames])
    ])

    if (activeDrag.mode === 'start') {
      startFrame = nearestCueSnap(startFrame, candidates, threshold) ?? startFrame
      durationFrames = clampNumber(activeDrag.startFrame + activeDrag.durationFrames - startFrame, 1, Math.max(1, activeDrag.item.durationFrames - startFrame))
    } else if (activeDrag.mode === 'end') {
      const snappedEnd = nearestCueSnap(startFrame + durationFrames, candidates, threshold)
      if (typeof snappedEnd === 'number') durationFrames = Math.max(1, snappedEnd - startFrame)
      durationFrames = clampNumber(durationFrames, 1, Math.max(1, activeDrag.item.durationFrames - startFrame))
    } else {
      const snapStarts = candidates
      const snapEnds = candidates.map((frame) => frame - durationFrames)
      startFrame = nearestCueSnap(startFrame, [...snapStarts, ...snapEnds], threshold) ?? startFrame
      startFrame = clampNumber(startFrame, 0, Math.max(0, activeDrag.item.durationFrames - durationFrames))
    }

    return { startFrame, durationFrames }
  }

  function nearestCueSnap(value: number, candidates: number[], threshold: number): number | null {
    let winner: number | null = null
    let distance = threshold + 1
    candidates.forEach((candidate) => {
      const nextDistance = Math.abs(candidate - value)
      if (nextDistance <= threshold && nextDistance < distance) {
        winner = Math.round(candidate)
        distance = nextDistance
      }
    })
    return winner
  }

  function fillRoleStateGap(item: TimelineItem, gap: { startFrame: number; durationFrames: number }): void {
    const states = normalizeRoleStates(item.roleStates, item.durationFrames)
    if (!states.length) return
    const gapEnd = gap.startFrame + gap.durationFrames
    const previous = [...states].reverse().find((state) => state.startFrame + state.durationFrames <= gap.startFrame)
    const next = states.find((state) => state.startFrame >= gapEnd)
    let nextStates = states
    if (previous) {
      nextStates = states.map((state) =>
        state.id === previous.id ? { ...state, durationFrames: gapEnd - state.startFrame } : state
      )
    } else if (next) {
      nextStates = states.map((state) =>
        state.id === next.id ? { ...state, startFrame: gap.startFrame, durationFrames: state.durationFrames + (state.startFrame - gap.startFrame) } : state
      )
    }
    onPatchItem(item.id, { roleStates: normalizeRoleStates(nextStates, item.durationFrames) }, { label: '补齐角色空隙' })
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
      className={`timeline ${razorMode ? 'razor-mode' : ''} ${dragState ? 'dragging-item' : ''} ${cueDrag?.mode === 'move' ? 'cue-moving' : ''} ${cueDrag && cueDrag.mode !== 'move' ? 'cue-resizing' : ''}`}
      onWheel={(event) => {
        if (!event.ctrlKey) return
        event.preventDefault()
        onTimelineZoom(clampNumber(timelineZoom * (event.deltaY < 0 ? 1.12 : 0.88), 1, 4))
      }}
    >
      <div
        className="timeline-scale"
        style={{ width: `${timelineZoom * 100}%` }}
        onDragOver={handleTimelineBlankDragOver}
        onDrop={handleTimelineBlankDrop}
      >
        <div className="track-group-tabs">
          <button className={activeGroup === 'all' ? 'track-group-tab active' : 'track-group-tab'} onClick={() => onActiveGroupChange('all')}>
            <Layers size={14} />
            全部
            <span>{project.timeline.filter(isTimelineCountItem).length}</span>
          </button>
          {TRACK_GROUPS.map((group) => {
            const groupTrackIds = new Set(project.tracks.filter((track) => trackGroupId(track) === group.id).map((track) => track.id))
            const count = project.timeline.filter((item) => groupTrackIds.has(item.trackId) && isTimelineCountItem(item)).length
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
            <button className="project-end-handle" style={{ left: '100%' }} title="拖动设置工程总时长" onPointerDown={beginDurationDrag} />
          </div>
        </div>
        {visibleGroups.map((group) => {
          const tracks = project.tracks.filter((track) => trackGroupId(track) === group.id)
          const trackIds = new Set(tracks.map((track) => track.id))
          const groupItems = project.timeline.filter((item) => trackIds.has(item.trackId) && isTimelineCountItem(item))
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
                    <div
                      className="track-label"
                      title={displayTrackName(track)}
                      onPointerDown={() => onSelectTrack(track.id)}
                      onDragOver={(event) => handleAssetTrackLabelDragOver(event, track)}
                      onDragLeave={() => setTrackDropTarget((current) => (current === track.id ? null : current))}
                      onDrop={(event) => handleAssetTrackLabelDrop(event, track)}
                    >
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
                      {cueDropPreview?.trackId === track.id && (
                        <div className={cueDropPreview.valid ? 'timeline-drop-ghost cue-drop' : 'timeline-drop-ghost cue-drop invalid'} style={{
                          left: `${(cueDropPreview.frame / totalFrames) * 100}%`,
                          width: `${Math.max(1.2, (cueDropPreview.durationFrames / totalFrames) * 100)}%`
                        }}>
                          移动 cue
                        </div>
                      )}
                      {track.kind === 'subtitle' && !items.some(isSubtitleStreamItem) && (
                        <button
                          type="button"
                          className="timeline-empty-action"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation()
                            onCreateSubtitleStream(track.id)
                          }}
                        >
                          <Plus size={14} />
                          创建字幕流
                        </button>
                      )}
                      {track.kind === 'visual' && trackGroupId(track) === 'role' && !items.some(isRoleInstanceItem) && (
                        <button
                          type="button"
                          className="timeline-empty-action"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation()
                            onCreateRoleStream(track.id)
                          }}
                        >
                          <Plus size={14} />
                          创建角色流
                        </button>
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
                          title={timelineItemTitle(item, availableAssets)}
                        >
                          <span className="resize-handle left" title="变速拉伸片段左边缘" onPointerDown={(event) => (razorMode ? cutItemFromPointer(event, item) : beginDrag(event, item, 'rate-start'))} />
                          <span>{item.label}</span>
                          {isSubtitleStreamItem(item) && (
                            <span className="timeline-cue-track subtitle-cues" aria-hidden="true">
                              {(() => {
                                const cues = normalizeSubtitleCues(item.subtitleCues, item.durationFrames)
                                const conflicts = subtitleCueConflictIds(cues)
                                return cues.map((cue) => (
                                  <span
                                    key={cue.id}
                                    className={`timeline-cue-marker ${selectedCue?.itemId === item.id && selectedCue.cueId === cue.id ? 'selected' : ''} ${conflicts.has(cue.id) ? 'conflict' : ''}`}
                                    style={{
                                      left: `${(cue.startFrame / Math.max(1, item.durationFrames)) * 100}%`,
                                      width: `${Math.max(2.8, (cue.durationFrames / Math.max(1, item.durationFrames)) * 100)}%`
                                    }}
                                    title={`${cue.text} · ${formatTime(item.startFrame + cue.startFrame, fps)}`}
                                    onPointerDown={(event) => beginCueDrag(event, item, cue, 'subtitle', 'move')}
                                  >
                                    <i className="cue-edge left" onPointerDown={(event) => beginCueDrag(event, item, cue, 'subtitle', 'start')} />
                                    <i className="cue-edge right" onPointerDown={(event) => beginCueDrag(event, item, cue, 'subtitle', 'end')} />
                                  </span>
                                ))
                              })()}
                            </span>
                          )}
                          {isRoleInstanceItem(item) && (
                            <span className="timeline-cue-track role-states" aria-hidden="true">
                              {roleStateGaps(normalizeRoleStates(item.roleStates, item.durationFrames), item.durationFrames).map((gap) => (
                                <span
                                  className="timeline-cue-gap"
                                  key={`${gap.startFrame}-${gap.durationFrames}`}
                                  title={`角色空隙：${formatTime(item.startFrame + gap.startFrame, fps)} - ${formatTime(item.startFrame + gap.startFrame + gap.durationFrames, fps)} 无素材显示`}
                                  onPointerDown={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    onSelect(item.id)
                                  }}
                                  onDoubleClick={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    fillRoleStateGap(item, gap)
                                  }}
                                  style={{
                                    left: `${(gap.startFrame / Math.max(1, item.durationFrames)) * 100}%`,
                                    width: `${Math.max(1.6, (gap.durationFrames / Math.max(1, item.durationFrames)) * 100)}%`
                                  }}
                                />
                              ))}
                              {normalizeRoleStates(item.roleStates, item.durationFrames).map((state) => {
                                const asset = availableAssets.find((asset) => asset.id === state.assetId)
                                return (
                                  <span
                                    key={state.id}
                                    className={`timeline-cue-marker ${selectedCue?.itemId === item.id && selectedCue.cueId === state.id ? 'selected' : ''} ${state.muted ? 'muted' : ''}`}
                                    style={{
                                      left: `${(state.startFrame / Math.max(1, item.durationFrames)) * 100}%`,
                                      width: `${Math.max(3, (state.durationFrames / Math.max(1, item.durationFrames)) * 100)}%`
                                    }}
                                    title={`${asset ? assetDisplayName(asset) : state.label || '角色状态'} · ${formatTime(item.startFrame + state.startFrame, fps)}`}
                                    onPointerDown={(event) => beginCueDrag(event, item, state, 'role', 'move')}
                                  >
                                    <i className="cue-edge left" onPointerDown={(event) => beginCueDrag(event, item, state, 'role', 'start')} />
                                    <span className="timeline-cue-audio">{state.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}</span>
                                    <i className="cue-edge right" onPointerDown={(event) => beginCueDrag(event, item, state, 'role', 'end')} />
                                  </span>
                                )
                              })}
                            </span>
                          )}
                          {item.type === 'visual' && visualKeyframes(item).length > 0 && (
                            <span className="timeline-keyframe-track" aria-hidden="true">
                              {visualKeyframes(item).map((keyframe) => (
                                <span
                                  key={keyframe.id}
                                  className={`timeline-keyframe-marker ${selectedKeyframe?.itemId === item.id && selectedKeyframe.keyframeId === keyframe.id ? 'selected' : ''}`}
                                  style={{ left: `${(keyframe.frame / Math.max(1, item.durationFrames)) * 100}%` }}
                                  title={`Keyframe ${keyframe.frame}`}
                                  onPointerDown={(event) => beginKeyframeDrag(event, item, keyframe)}
                                />
                              ))}
                            </span>
                          )}
                          <span className="resize-handle right" title="变速拉伸片段右边缘" onPointerDown={(event) => (razorMode ? cutItemFromPointer(event, item) : beginDrag(event, item, 'rate-end'))} />
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
  lastCover,
  onChangeCustomPreset,
  onChooseExportDir,
  onPreview,
  onExport,
  onExportCover,
  onExportAs
}: {
  project: ProjectFile
  preset: ExportPreset
  settings: AppSettings
  workspace: WorkspaceInfo
  lastExport: RenderResult | null
  lastCover: RenderResult | null
  onChangeCustomPreset: (patch: Partial<ExportPreset>) => void
  onChooseExportDir: () => void
  onPreview: () => void
  onExport: () => void
  onExportCover: () => void
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
      <button className="command wide" onClick={onExportCover}>
        <ImageIcon size={16} />
        导出封面 JPG
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
      {lastCover && (
        <div className="export-result">
          <strong>最近封面</strong>
          <span>{lastCover.outputPath}</span>
          <button className="command wide" onClick={() => window.catMeme.showItem(lastCover.outputPath)}>
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

function RoleLabelInspector({
  project,
  item,
  onPatch
}: {
  project: ProjectFile
  item: TimelineItem
  onPatch: (patch: Partial<TimelineItem>) => void
}): JSX.Element {
  const label = roleLabelForItem(project, item)
  const patchLabel = (patch: NonNullable<TimelineItem['roleLabel']>): void => {
    onPatch({ roleLabel: mergeRoleLabelPatch(project, item, patch) })
  }
  const patchStyle = (patch: Partial<ProjectFile['subtitleStyle']>): void => {
    patchLabel({ style: { ...label.style, ...patch } })
  }

  return (
    <div className="transform-editor role-label-editor">
      <div className="panel-title mini">
        <Captions />
        <strong>角色名称</strong>
      </div>
      <label className="field compact">
        <span>名称</span>
        <input
          value={label.text}
          onChange={(event) => patchLabel({ text: event.target.value, visible: item.roleLabel?.visible ?? true })}
        />
      </label>
      <label className="toggle-field">
        <input type="checkbox" checked={label.visible} onChange={(event) => patchLabel({ visible: event.target.checked })} />
        <span>显示名称</span>
      </label>
      <div className="number-grid">
        <label className="field compact">
          <span>位置</span>
          <select value={label.style.position} onChange={(event) => patchStyle({ position: event.target.value as ProjectFile['subtitleStyle']['position'] })}>
            <option value="top">上方</option>
            <option value="middle">中间</option>
            <option value="bottom">下方</option>
          </select>
        </label>
        <NumberField label="字号" value={label.style.fontSize} onChange={(value) => patchStyle({ fontSize: Math.max(12, value) })} />
        <label className="field compact">
          <span>文字颜色</span>
          <input type="color" value={label.style.color} onChange={(event) => patchStyle({ color: event.target.value })} />
        </label>
        <label className="field compact">
          <span>描边颜色</span>
          <input type="color" value={label.style.outlineColor} onChange={(event) => patchStyle({ outlineColor: event.target.value })} />
        </label>
        <NumberField label="描边宽度" value={label.style.outlineWidth} onChange={(value) => patchStyle({ outlineWidth: Math.max(0, value) })} />
        <label className="field compact">
          <span>背景颜色</span>
          <input type="color" value={label.style.backgroundColor} onChange={(event) => patchStyle({ backgroundColor: event.target.value })} />
        </label>
      </div>
      <label className="toggle-field">
        <input type="checkbox" checked={label.style.background} onChange={(event) => patchStyle({ background: event.target.checked })} />
        <span>名称背景</span>
      </label>
    </div>
  )
}

function InspectorHint({ children }: { children: ReactNode }): JSX.Element {
  return <small className="inspector-hint">{children}</small>
}

function InspectorDisclosure({ title, meta, children }: { title: string; meta?: string; children: ReactNode }): JSX.Element {
  return (
    <details className="inspector-disclosure">
      <summary>
        <span>{title}</span>
        {meta && <small>{meta}</small>}
      </summary>
      <div className="inspector-disclosure-body">{children}</div>
    </details>
  )
}

function VisualKeyframeEditor({
  item,
  fps,
  playheadFrame,
  selectedKeyframeId,
  onPatch,
  onSelectKeyframe,
  onSeek
}: {
  item: TimelineItem
  fps: number
  playheadFrame: number
  selectedKeyframeId: string | null
  onPatch: (patch: Partial<TimelineItem>) => void
  onSelectKeyframe: (keyframeId: string, frame: number) => void
  onSeek: (frame: number) => void
}): JSX.Element {
  const localFrame = localFrameForItem(item, playheadFrame)
  const keyframes = visualKeyframes(item)
  const currentKeyframe = keyframes.find((keyframe) => keyframe.frame === localFrame)
  const previous = [...keyframes].reverse().find((keyframe) => keyframe.frame < localFrame)
  const next = keyframes.find((keyframe) => keyframe.frame > localFrame)
  const state = visualAnimationStateAtFrame(item, localFrame)
  const transform = state.transform
  const primaryEffect = primaryVisualEffect(item.effects)

  function patchCurrentFrame(patch: Partial<VisualTransform> & { effectIntensity?: number }): void {
    onPatch(patchVisualTransformAtFrame(item, localFrame, patch))
  }

  function addOrUpdateKeyframe(): void {
    const keyframes = upsertVisualKeyframe(item, localFrame, state)
    const keyframe = keyframes.find((entry) => entry.frame === localFrame)
    onPatch({ keyframes })
    if (keyframe) onSelectKeyframe(keyframe.id, keyframe.frame)
  }

  function seekKeyframe(keyframe?: VisualKeyframe): void {
    if (!keyframe) return
    onSelectKeyframe(keyframe.id, keyframe.frame)
    onSeek(item.startFrame + keyframe.frame)
  }

  function moveCurrentKeyframe(frame: number): void {
    if (!currentKeyframe) return
    const moved = moveVisualKeyframe(item, currentKeyframe.id, frame)
    onPatch({ keyframes: moved.keyframes })
    onSelectKeyframe(currentKeyframe.id, moved.frame)
  }

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
      <div className="keyframe-current-grid">
        <Metric label="X" value={String(Math.round(transform.x))} />
        <Metric label="Y" value={String(Math.round(transform.y))} />
        <Metric label="Scale" value={transform.scale.toFixed(2)} />
        <Metric label="Rot" value={String(Math.round(transform.rotation))} />
        <Metric label="Opacity" value={transform.opacity.toFixed(2)} />
        <Metric label="FX" value={typeof state.effectIntensity === 'number' ? state.effectIntensity.toFixed(2) : '--'} />
      </div>
      <div className="keyframe-edit-grid">
        <NumberField label="X" value={Math.round(transform.x)} onChange={(value) => patchCurrentFrame({ x: value })} />
        <NumberField label="Y" value={Math.round(transform.y)} onChange={(value) => patchCurrentFrame({ y: value })} />
        <label className="field compact">
          <span>Scale</span>
          <input type="number" min={0.08} max={4} step={0.05} value={transform.scale} onChange={(event) => patchCurrentFrame({ scale: Number(event.target.value) || 1 })} />
        </label>
        <NumberField label="Rot" value={Math.round(transform.rotation)} onChange={(value) => patchCurrentFrame({ rotation: value })} />
        <label className="field compact">
          <span>Opacity</span>
          <input type="number" min={0} max={1} step={0.05} value={transform.opacity} onChange={(event) => patchCurrentFrame({ opacity: Number(event.target.value) || 0 })} />
        </label>
        <label className="field compact">
          <span>FX Intensity</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={typeof state.effectIntensity === 'number' ? state.effectIntensity : 0}
            disabled={!primaryEffect}
            onChange={(event) => patchCurrentFrame({ effectIntensity: clampNumber(Number(event.target.value) || 0, 0, 1) })}
          />
        </label>
        <NumberField label="Frame" value={localFrame} onChange={moveCurrentKeyframe} />
      </div>
      {keyframes.length > 0 && (
        <div className="keyframe-list">
          {keyframes.map((keyframe) => (
            <button
              type="button"
              key={keyframe.id}
              className={selectedKeyframeId === keyframe.id || keyframe.frame === localFrame ? 'keyframe-chip active' : 'keyframe-chip'}
              onClick={() => seekKeyframe(keyframe)}
            >
              <span>{keyframe.frame}</span>
              <small>{formatTime(item.startFrame + keyframe.frame, fps)}</small>
            </button>
          ))}
        </div>
      )}
      <div className="keyframe-actions">
        <button className="command compact" onClick={addOrUpdateKeyframe}>
          {currentKeyframe ? '更新' : '添加'}
        </button>
        <button className="command compact" disabled={!previous} onClick={() => seekKeyframe(previous)}>
          上一帧
        </button>
        <button className="command compact" disabled={!next} onClick={() => seekKeyframe(next)}>
          下一帧
        </button>
        <button className="command compact danger" disabled={!currentKeyframe} onClick={() => onPatch({ keyframes: removeVisualKeyframe(item, localFrame) })}>
          删除
        </button>
      </div>
      <InspectorHint>当前帧有关键帧时，变换会更新该帧。</InspectorHint>
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
      <InspectorDisclosure title="变换预设" meta="快速摆位">
        <div className="transform-presets">
          <button onClick={() => patchTransform({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false, opacity: 1 })}>全屏</button>
          <button onClick={() => patchTransform({ x: -260, y: 140, scale: 0.42, rotation: 0, opacity: 1 })}>左下角色</button>
          <button onClick={() => patchTransform({ x: 260, y: 140, scale: 0.42, rotation: 0, opacity: 1 })}>右下角色</button>
          <button onClick={() => patchTransform({ x: 0, y: -420, scale: 0.34, rotation: 0, opacity: 1 })}>顶部表情</button>
          <button onClick={() => patchTransform({ rotation: transform.rotation - 15 })}>左旋 15°</button>
          <button onClick={() => patchTransform({ rotation: transform.rotation + 15 })}>右旋 15°</button>
        </div>
      </InspectorDisclosure>
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
        <strong>对白字幕</strong>
      </div>
      <label className="field compact">
        <span>字幕内容</span>
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

function SubtitleStreamInspector({
  project,
  item,
  fps,
  playheadFrame,
  selectedCueId,
  onSelectCue,
  onPatch
}: {
  project: ProjectFile
  item: TimelineItem
  fps: number
  playheadFrame: number
  selectedCueId: string | null
  onSelectCue: (cueId: string, absoluteFrame: number) => void
  onPatch: (patch: Partial<TimelineItem>) => void
}): JSX.Element {
  const style = normalizeSubtitleStyle(project.subtitleStyle, item.style)
  const box = normalizeSubtitleBox(item.subtitleBox)
  const cues = normalizeSubtitleCues(item.subtitleCues, item.durationFrames)
  const binding = normalizeSubtitleBinding(item.subtitleBinding)
  const localFrame = clampNumber(playheadFrame - item.startFrame, 0, Math.max(0, item.durationFrames - 1))
  const conflictIds = subtitleCueConflictIds(cues)
  const patchStyle = (patch: Partial<ProjectFile['subtitleStyle']>): void => onPatch({ style: normalizeSubtitleStyleConfig({ ...style, ...patch }) })
  const patchBox = (patch: Partial<SubtitleBox>): void => onPatch({ subtitleBox: normalizeSubtitleBox({ ...box, ...patch }) })
  const patchCue = (cueId: string, patch: Partial<SubtitleCue>): void => {
    onPatch({
      subtitleCues: normalizeSubtitleCues(
        cues.map((cue) => (cue.id === cueId ? { ...cue, ...patch } : cue)),
        item.durationFrames
      )
    })
  }
  const addCue = (): void => {
    const cue: SubtitleCue = {
      id: crypto.randomUUID(),
      startFrame: localFrame,
      durationFrames: Math.min(Math.round(fps * 2.8), Math.max(1, item.durationFrames - localFrame)),
      text: '新字幕'
    }
    onPatch({ subtitleCues: normalizeSubtitleCues([...cues, cue], item.durationFrames) })
  }
  const deleteCue = (cueId: string): void => onPatch({ subtitleCues: cues.filter((cue) => cue.id !== cueId) })

  return (
    <div className="subtitle-stream-editor">
      <div className="panel-title mini">
        <Captions />
        <strong>字幕流</strong>
        <small>{cues.length} cue</small>
      </div>
      <label className="field compact">
        <span>绑定角色</span>
        <select
          value={binding?.roleId || ''}
          onChange={(event) => onPatch({ subtitleBinding: event.target.value ? { roleId: event.target.value, hideWhenRoleMissing: true } : undefined })}
        >
          <option value="">不绑定</option>
          {projectRoles(project).map((role) => (
            <option value={role.id} key={role.id}>
              {roleSpeakerLabel(role)}
            </option>
          ))}
        </select>
      </label>
      <SubtitleStylePanel style={style} onChange={patchStyle} />
      <InspectorDisclosure title="文本框" meta={`${Math.round(box.widthPct)}%`}>
        <div className="number-grid">
          <NumberField label="宽度%" value={Math.round(box.widthPct)} onChange={(value) => patchBox({ widthPct: value })} />
          <NumberField label="高度%" value={Math.round(box.heightPct || 18)} onChange={(value) => patchBox({ heightPct: value, autoHeight: false })} />
          <NumberField label="内边距" value={box.padding} onChange={(value) => patchBox({ padding: value })} />
          <NumberField label="行高x100" value={Math.round(box.lineHeight * 100)} onChange={(value) => patchBox({ lineHeight: value / 100 })} />
          <label className="field compact">
            <span>水平对齐</span>
            <select value={box.textAlign} onChange={(event) => patchBox({ textAlign: event.target.value as SubtitleBox['textAlign'] })}>
              <option value="left">左</option>
              <option value="center">中</option>
              <option value="right">右</option>
            </select>
          </label>
          <label className="field compact">
            <span>垂直对齐</span>
            <select value={box.verticalAlign} onChange={(event) => patchBox({ verticalAlign: event.target.value as SubtitleBox['verticalAlign'] })}>
              <option value="top">上</option>
              <option value="middle">中</option>
              <option value="bottom">下</option>
            </select>
          </label>
        </div>
        <label className="toggle-field compact-toggle">
          <input type="checkbox" checked={box.autoHeight} onChange={(event) => patchBox({ autoHeight: event.target.checked })} />
          <span>自动高度</span>
        </label>
      </InspectorDisclosure>
      <InspectorDisclosure title="台词 cue" meta={`${cues.length}`}>
        <button className="command ghost" onClick={addCue}>
          <Plus size={15} />
          当前帧添加
        </button>
        <div className="cue-list">
          {cues.map((cue, index) => {
            const endFrame = cue.startFrame + cue.durationFrames
            return (
              <div
                className={`cue-row ${selectedCueId === cue.id ? 'active' : ''} ${conflictIds.has(cue.id) ? 'conflict' : ''}`}
                key={cue.id}
                onPointerDown={() => onSelectCue(cue.id, item.startFrame + cue.startFrame)}
              >
                <div className="cue-row-title">
                  <button className="time-pill" onClick={() => patchCue(cue.id, { startFrame: localFrame })}>{formatTime(item.startFrame + cue.startFrame, fps)}</button>
                  <strong>Cue {index + 1}</strong>
                  {conflictIds.has(cue.id) && <small className="danger-text">重合</small>}
                  <button className="icon-button danger" title="删除 cue" onClick={() => deleteCue(cue.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <label className="field compact">
                  <span>Text</span>
                  <textarea value={cue.text} onChange={(event) => patchCue(cue.id, { text: event.target.value })} />
                </label>
                <div className="number-grid">
                  <NumberField label="起始帧" value={cue.startFrame} onChange={(value) => patchCue(cue.id, { startFrame: value })} />
                  <NumberField label="结束帧" value={endFrame} onChange={(value) => patchCue(cue.id, { durationFrames: Math.max(1, value - cue.startFrame) })} />
                  <NumberField label="持续帧" value={cue.durationFrames} onChange={(value) => patchCue(cue.id, { durationFrames: value })} />
                </div>
              </div>
            )
          })}
        </div>
      </InspectorDisclosure>
    </div>
  )
}

function RoleCueThumb({ asset, label }: { asset?: Asset; label: string }): JSX.Element {
  const [failed, setFailed] = useState(false)
  const src = asset ? roleCueImageSrc(asset) : ''

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (src && !failed) {
    return (
      <div className="role-state-thumb" title={asset ? assetDisplayName(asset) : label}>
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      </div>
    )
  }

  return (
    <div className="role-state-thumb empty" title={asset ? assetDisplayName(asset) : label}>
      <ImageIcon size={18} />
      <span>{asset ? assetDisplayName(asset) : label}</span>
    </div>
  )
}

function RoleInstanceInspector({
  project,
  item,
  availableAssets,
  fps,
  playheadFrame,
  selectedCueId,
  onSelectCue,
  onAddRoleCue,
  onPatch
}: {
  project: ProjectFile
  item: TimelineItem
  availableAssets: Asset[]
  fps: number
  playheadFrame: number
  selectedCueId: string | null
  onSelectCue: (cueId: string, absoluteFrame: number) => void
  onAddRoleCue: (assetId: string, replaceCueId?: string) => void
  onPatch: (patch: Partial<TimelineItem>) => void
}): JSX.Element {
  const states = normalizeRoleStates(item.roleStates, item.durationFrames)
  const localFrame = clampNumber(playheadFrame - item.startFrame, 0, Math.max(0, item.durationFrames - 1))
  const activeState = states.find((state) => localFrame >= state.startFrame && localFrame < state.startFrame + state.durationFrames) || states[0]
  const selectedState = states.find((state) => state.id === selectedCueId) || activeState
  const gaps = roleStateGaps(states, item.durationFrames)
  const roleAssets = mergeAssets(project.assets, availableAssets).filter((asset) => isVisualAsset(asset) && !isBackgroundAsset(asset))
  const [assetId, setAssetId] = useState(roleAssets[0]?.id || '')

  useEffect(() => {
    if (!assetId && roleAssets[0]?.id) setAssetId(roleAssets[0].id)
  }, [assetId, roleAssets])

  const patchState = (stateId: string, patch: Partial<RoleStateCue>): void => {
    const nextStates = states.map((state) => (state.id === stateId ? { ...state, ...patch } : state))
    onPatch({ roleStates: resolveRoleStateOverlaps(nextStates, stateId, item.durationFrames) })
  }
  const deleteState = (stateId: string): void => onPatch({ roleStates: states.filter((state) => state.id !== stateId) })
  return (
    <div className="role-instance-editor">
      <div className="panel-title mini">
        <Layers />
        <strong>角色流</strong>
        <small>{states.length} 状态</small>
      </div>
      {gaps.length > 0 && (
        <div className="inline-warning-action">
          <span>存在 {gaps.length} 段空隙</span>
          <button onClick={() => onPatch({ roleStates: fillRoleStateGaps(states, item.durationFrames) })}>一键补齐</button>
        </div>
      )}
      <InspectorDisclosure title="新增 / 替换 cue" meta={roleAssets.length ? `${roleAssets.length} 素材` : '无素材'}>
        <label className="field compact">
          <span>角色素材</span>
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            {roleAssets.map((asset) => (
              <option value={asset.id} key={asset.id}>
                {assetDisplayName(asset)}
              </option>
            ))}
          </select>
        </label>
        <div className="two-buttons">
          <button className="command ghost" disabled={!assetId} onClick={() => onAddRoleCue(assetId)}>
            <Plus size={15} />
            当前帧添加
          </button>
          <button className="command ghost" disabled={!assetId || !selectedState} onClick={() => selectedState && onAddRoleCue(assetId, selectedState.id)}>
            <ImageIcon size={15} />
            替换选中
          </button>
        </div>
      </InspectorDisclosure>
      <div className="cue-list">
        {states.map((state) => {
          const asset = roleAssets.find((entry) => entry.id === state.assetId) || project.assets.find((entry) => entry.id === state.assetId)
          const endFrame = state.startFrame + state.durationFrames
          const selected = selectedState?.id === state.id
          return (
            <div
              className={`cue-row role-state-cue ${selected ? 'active selected' : ''}`}
              key={state.id}
              onPointerDown={() => onSelectCue(state.id, item.startFrame + state.startFrame)}
            >
              <RoleCueThumb asset={asset} label={state.label || '状态'} />
              <div className="role-state-main">
                <div className="role-state-top">
                  <button className="time-pill" onClick={() => patchState(state.id, { startFrame: localFrame })}>{formatTime(item.startFrame + state.startFrame, fps)}</button>
                  <strong>{state.label || (asset ? assetDisplayName(asset) : '') || '状态'}</strong>
                  <button
                    className={state.muted ? 'icon-button muted active' : 'icon-button muted'}
                    title={state.muted ? '恢复此 cue 原声' : '静音此 cue 原声'}
                    onClick={() => patchState(state.id, { muted: !state.muted })}
                  >
                    {state.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  </button>
                  <button className="icon-button danger" title="删除状态" onClick={() => deleteState(state.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="number-grid">
                  <NumberField label="起始帧" value={state.startFrame} onChange={(value) => patchState(state.id, { startFrame: value })} />
                  <NumberField label="结束帧" value={endFrame} onChange={(value) => patchState(state.id, { durationFrames: Math.max(1, value - state.startFrame) })} />
                  <NumberField label="持续帧" value={state.durationFrames} onChange={(value) => patchState(state.id, { durationFrames: value })} />
                  <NumberField label="缩放x100" value={Math.round((state.scale ?? 1) * 100)} onChange={(value) => patchState(state.id, { scale: value / 100 })} />
                  <NumberField label="偏移X" value={state.offsetX || 0} onChange={(value) => patchState(state.id, { offsetX: value })} />
                  <NumberField label="偏移Y" value={state.offsetY || 0} onChange={(value) => patchState(state.id, { offsetY: value })} />
                  <NumberField label="入点帧" value={state.sourceInFrame || 0} onChange={(value) => patchState(state.id, { sourceInFrame: value })} />
                  <NumberField label="音量%" value={Math.round((state.volume ?? 1) * 100)} onChange={(value) => patchState(state.id, { volume: value / 100 })} />
                </div>
                <label className="field compact">
                  <span>尺寸匹配</span>
                  <select value={state.fitMode || 'visible-bounds'} onChange={(event) => patchState(state.id, { fitMode: event.target.value as RoleStateCue['fitMode'] })}>
                    <option value="visible-bounds">可见主体</option>
                    <option value="previous">跟随上一段</option>
                    <option value="native">素材原始</option>
                  </select>
                </label>
              </div>
            </div>
          )
        })}
      </div>
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
    <InspectorDisclosure title="绿幕抠像" meta={keying.enabled ? '已启用' : '可选'}>
      <label className="toggle-field compact-toggle">
        <input type="checkbox" checked={keying.enabled} onChange={(event) => patchKeying({ enabled: event.target.checked })} />
        <span>启用抠像</span>
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
    </InspectorDisclosure>
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

function fallbackPreviewDisplayScale(width: number, height: number): number {
  const safeWidth = Math.max(1, Math.round(width || 1080))
  const safeHeight = Math.max(1, Math.round(height || 1920))
  const maxPreviewWidth = safeWidth >= safeHeight ? 680 : safeWidth
  const maxPreviewHeight = safeWidth >= safeHeight ? safeHeight : 560
  return previewDisplayScaleForStage(maxPreviewWidth, maxPreviewHeight, safeWidth, safeHeight)
}

function previewDisplayScaleForStage(stageWidth: number, stageHeight: number, presetWidth: number, presetHeight: number): number {
  const widthScale = stageWidth / Math.max(1, presetWidth)
  const heightScale = stageHeight / Math.max(1, presetHeight)
  return clampNumber(Math.min(widthScale, heightScale), 0.04, 1)
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

function previewTextLayerStyle(
  kind: 'speaker' | 'subtitle',
  position: ProjectFile['subtitleStyle']['position'],
  transform: ReturnType<typeof normalizeTransform>,
  presetWidth: number,
  presetHeight: number
): CSSProperties {
  const baseY = kind === 'speaker' ? speakerPositionPercent(position) : subtitlePositionPercent(position)
  return {
    left: `${50 + (transform.x / presetWidth) * 100}%`,
    top: `${baseY + (transform.y / presetHeight) * 100}%`,
    width: kind === 'speaker' ? '78%' : '86%',
    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`,
    opacity: transform.opacity
  }
}

function previewSubtitleLayerStyle(
  position: ProjectFile['subtitleStyle']['position'],
  transform: ReturnType<typeof normalizeTransform>,
  presetWidth: number,
  presetHeight: number,
  box: SubtitleBox
): CSSProperties {
  return {
    ...previewTextLayerStyle('subtitle', position, transform, presetWidth, presetHeight),
    width: `${box.widthPct}%`,
    ...(box.autoHeight ? {} : { height: `${box.heightPct || 18}%` })
  }
}

function previewRoleLabelPositionStyle(position: ProjectFile['subtitleStyle']['position'], bounds: VisibleBounds): CSSProperties {
  const centerX = (bounds.left + bounds.width / 2) * 100
  if (position === 'top') {
    return { left: `${centerX}%`, top: `${bounds.top * 100}%`, transform: 'translate(-50%, calc(-100% - 6px))' }
  }
  if (position === 'middle') {
    return { left: `${centerX}%`, top: `${(bounds.top + bounds.height / 2) * 100}%`, transform: 'translate(-50%, -50%)' }
  }
  return { left: `${centerX}%`, top: `${(bounds.top + bounds.height) * 100}%`, transform: 'translate(-50%, 6px)' }
}

function subtitlePositionPercent(position: ProjectFile['subtitleStyle']['position']): number {
  if (position === 'top') return 30
  if (position === 'middle') return 50
  return 91
}

function speakerPositionPercent(position: ProjectFile['subtitleStyle']['position']): number {
  if (position === 'top') return 6
  if (position === 'middle') return 38
  return 96
}

function applyTimelineEffects(
  item: TimelineItem,
  transform: NormalizedTransform,
  localFrame: number,
  fps: number,
  presetWidth: number,
  presetHeight: number,
  effectIntensityOverride?: number
): { transform: NormalizedTransform; filter?: string } {
  const durationFrames = Math.max(1, item.durationFrames)
  const progress = clampNumber(localFrame / durationFrames, 0, 1)
  let nextTransform = { ...transform }
  let brightness = 1
  let saturation = 1
  const primaryEffect = primaryVisualEffect(item.effects)

  item.effects.forEach((effect) => {
    const intensity = clampNumber(effect.id === primaryEffect?.id && typeof effectIntensityOverride === 'number' ? effectIntensityOverride : effect.intensity, 0, 1)
    if (effect.type === 'zoom-in') {
      nextTransform = { ...nextTransform, scale: clampNumber(nextTransform.scale * (1 + intensity * progress), 0.08, 4) }
    } else if (effect.type === 'zoom-out') {
      nextTransform = { ...nextTransform, scale: clampNumber(nextTransform.scale * (1 + intensity * (1 - progress)), 0.08, 4) }
    } else if (effect.type === 'pan-left') {
      nextTransform = { ...nextTransform, x: nextTransform.x + Math.round(presetWidth * intensity * (0.5 - progress) * 0.5) }
    } else if (effect.type === 'pan-right') {
      nextTransform = { ...nextTransform, x: nextTransform.x + Math.round(presetWidth * intensity * (progress - 0.5) * 0.5) }
    } else if (effect.type === 'shake') {
      const wave = localFrame * 2.35
      nextTransform = {
        ...nextTransform,
        x: nextTransform.x + Math.round(Math.sin(wave) * presetWidth * intensity * 0.018),
        y: nextTransform.y + Math.round(Math.cos(wave * 1.17) * presetHeight * intensity * 0.012),
        rotation: nextTransform.rotation + Math.sin(wave * 0.77) * intensity * 5
      }
    } else if (effect.type === 'flash') {
      const pulse = Math.max(0, Math.sin(progress * Math.PI))
      brightness += pulse * intensity * 1.25
      saturation += pulse * intensity * 0.25
    }
  })

  return {
    transform: nextTransform,
    filter: brightness > 1.001 || saturation > 1.001 ? `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)})` : undefined
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
  const sourceFrame = Math.max(0, item.sourceInFrame + localFrame * mediaPlaybackRateForAsset(item, asset))
  const rawSeconds = sourceFrame / fps
  if (!item.loop || !asset.duration || asset.duration <= 0.05) return rawSeconds
  return rawSeconds % asset.duration
}

function itemPlaybackRate(item: TimelineItem): number {
  return clampNumber(item.playbackRate ?? 1, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE)
}

function audioFadeMultiplier(item: TimelineItem, playheadFrame: number): number {
  const localFrame = clampNumber(playheadFrame - item.startFrame, 0, Math.max(0, item.durationFrames))
  const fadeIn = clampNumber(item.fadeInFrames || 0, 0, item.durationFrames)
  const fadeOut = clampNumber(item.fadeOutFrames || 0, 0, item.durationFrames)
  let multiplier = 1
  if (fadeIn > 0 && localFrame < fadeIn) multiplier = Math.min(multiplier, localFrame / fadeIn)
  if (fadeOut > 0) {
    const remaining = Math.max(0, item.durationFrames - localFrame)
    if (remaining < fadeOut) multiplier = Math.min(multiplier, remaining / fadeOut)
  }
  return clampNumber(multiplier, 0, 1)
}

function mediaPlaybackRateForAsset(item: TimelineItem, asset: Asset): number {
  return ['video', 'gif', 'audio'].includes(asset.type) ? itemPlaybackRate(item) : 1
}

function isRateStretchItem(item: TimelineItem, assets: Asset[]): boolean {
  const asset = item.assetId ? assets.find((entry) => entry.id === item.assetId) : null
  return Boolean(asset && ['video', 'gif', 'audio'].includes(asset.type))
}

function timelineItemTitle(item: TimelineItem, assets: Asset[]): string {
  const rate = isRateStretchItem(item, assets) ? ` · 变速 ${itemPlaybackRate(item).toFixed(2)}x` : ''
  return `${item.label} · 显示时长 ${item.durationFrames} 帧${rate}`
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
  const normalizedProjectFrames = Math.max(30, Math.round(normalizeProjectDurationSeconds(projectForDefaults, 30) * 30))
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
  const normalizedTimeline = project.timeline.map((item) => {
    const normalizedItem =
      item.type === 'subtitle'
        ? {
            ...item,
            startFrame: isSubtitleStreamItem(item) ? 0 : item.startFrame,
            durationFrames: isSubtitleStreamItem(item) ? normalizedProjectFrames : item.durationFrames,
            playbackRate: 1,
            speakerPosition: item.speakerPosition || 'bottom',
            style: item.style ? normalizeSubtitleStyleConfig({ ...subtitleStyle, ...upgradeLegacySubtitleStyle(item.style) }) : subtitleStyle,
            subtitleCues: isSubtitleStreamItem(item) ? normalizeSubtitleCues(item.subtitleCues, normalizedProjectFrames) : item.subtitleCues,
            subtitleBox: isSubtitleStreamItem(item) ? normalizeSubtitleBox(item.subtitleBox) : item.subtitleBox,
            subtitleBinding: normalizeSubtitleBinding(item.subtitleBinding)
          }
        : item.type === 'visual' && item.roleLabel
          ? {
              ...item,
              playbackRate: item.playbackRate === undefined ? 1 : clampNumber(item.playbackRate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE),
              roleLabel: mergeRoleLabelPatch({ ...project, tracks, assets: normalizedAssets, roles }, item, item.roleLabel),
              roleStates: isRoleInstanceItem(item) ? normalizeRoleStates(item.roleStates, item.durationFrames) : item.roleStates
            }
        : {
            ...item,
            playbackRate: item.playbackRate === undefined ? 1 : clampNumber(item.playbackRate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE),
            roleStates: isRoleInstanceItem(item) ? normalizeRoleStates(item.roleStates, item.durationFrames) : item.roleStates
          }
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
  const migratedTimeline = migrateLegacyRoleNameSubtitles(normalizedTimeline, tracks, roles, subtitleStyle)
  const occupiedTrackIds = new Set(migratedTimeline.map((item) => item.trackId))
  const roleStreamDefaults = tracks
    .filter((track) => track.kind === 'visual' && trackGroupId(track) === 'role' && !occupiedTrackIds.has(track.id))
    .map((track) =>
      createRoleStreamItem({ ...projectForDefaults, tracks, roles, subtitleStyle, timeline: migratedTimeline }, track, normalizedProjectFrames, roleForTrack({ ...projectForDefaults, tracks, roles, subtitleStyle, timeline: migratedTimeline }, track, roles))
    )
  const timeline = roleStreamDefaults.length ? [...migratedTimeline, ...roleStreamDefaults] : migratedTimeline
  return { ...project, tracks, assets: normalizedAssets, roles, subtitleStyle, timeline, durationSeconds: normalizeProjectDurationSeconds({ ...project, timeline }, 30) }
}

function migrateLegacyRoleNameSubtitles(
  timeline: TimelineItem[],
  tracks: TimelineTrack[],
  roles: CharacterRole[],
  subtitleStyle: ProjectFile['subtitleStyle']
): TimelineItem[] {
  const roleMap = new Map(roles.map((role) => [role.id, role]))
  const migrated = timeline.map((item) => ({ ...item }))
  const removeIds = new Set<string>()
  const projectForLabels: ProjectFile = {
    version: 1,
    id: '',
    title: '',
    workspaceRoot: '',
    createdAt: '',
    updatedAt: '',
    exportPresetId: '',
    tracks,
    timeline: migrated,
    assets: [],
    roles,
    script: '',
    subtitleStyle,
    aiRecords: []
  }

  migrated.forEach((item) => {
    if (!isRoleNameOnlySubtitle(item) && !(item.type === 'subtitle' && item.speakerName?.trim() && item.speakerVisible !== false)) return
    const speakerName = item.speakerName?.trim()
    if (!speakerName) return
    const visualItem = findLegacyRoleLabelVisualItem(migrated, item, tracks, roles)
    if (!visualItem) return
    const role = visualItem.roleId ? roleMap.get(visualItem.roleId) : undefined
    // Older projects stored role names as subtitle items. When a matching role clip exists,
    // move only the name onto that visual clip and keep any real subtitle text in place.
    visualItem.roleLabel = mergeRoleLabelPatch(projectForLabels, visualItem, {
      text: speakerName,
      visible: true,
      style: normalizeRoleLabelStyle({ ...item.style, position: item.speakerPosition || role?.speakerPosition || DEFAULT_ROLE_LABEL_STYLE.position })
    })
    if (item.text?.trim()) {
      item.speakerName = undefined
      item.speakerVisible = undefined
      item.speakerPosition = undefined
    } else {
      removeIds.add(item.id)
    }
  })

  return migrated.filter((item) => !removeIds.has(item.id))
}

function findLegacyRoleLabelVisualItem(
  timeline: TimelineItem[],
  subtitle: TimelineItem,
  tracks: TimelineTrack[],
  roles: CharacterRole[]
): TimelineItem | undefined {
  const speakerName = subtitle.speakerName?.trim() || ''
  const candidates = timeline.filter(
    (item) =>
      item.type === 'visual' &&
      isRoleVisualItem(item, tracks) &&
      item.startFrame < subtitle.startFrame + subtitle.durationFrames &&
      subtitle.startFrame < item.startFrame + item.durationFrames
  )
  const sameRole = subtitle.roleId ? candidates.find((item) => item.roleId === subtitle.roleId) : undefined
  if (sameRole) return sameRole

  const sameTiming = candidates.filter((item) => item.startFrame === subtitle.startFrame && item.durationFrames === subtitle.durationFrames)
  const matchingRoleName = sameTiming.find((item) => {
    const role = item.roleId ? roles.find((entry) => entry.id === item.roleId) : undefined
    return role ? speakerName === roleSpeakerLabel(role) || speakerName === role.name || speakerName.includes(role.name) : false
  })
  return matchingRoleName || sameTiming.find((item) => !item.roleLabel?.text?.trim()) || candidates.find((item) => !item.roleLabel?.text?.trim()) || sameTiming[0] || candidates[0]
}

function isRoleVisualItem(item: TimelineItem, tracks: TimelineTrack[]): boolean {
  const track = tracks.find((entry) => entry.id === item.trackId)
  return Boolean(item.roleId || trackGroupId(track) === 'role')
}

function normalizeProjectTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  return tracks
    .map((track) => ({ ...track, groupId: trackGroupId(track), locked: Boolean(track.locked), muted: Boolean(track.muted) }))
    .sort((a, b) => trackGroupOrder(trackGroupId(a)) - trackGroupOrder(trackGroupId(b)))
}

function prepareProjectForHistory(project: ProjectFile, fps = 30): ProjectFile {
  return {
    ...project,
    tracks: normalizeProjectTracks(project.tracks),
    durationSeconds: normalizeProjectDurationSeconds(project, fps),
    updatedAt: new Date().toISOString()
  }
}

function cloneProjectSnapshot(project: ProjectFile): ProjectFile {
  return structuredClone(project)
}

function projectHistoryKey(project: ProjectFile): string {
  return JSON.stringify({ ...project, updatedAt: '' })
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
    createdAt: asset.createdAt || new Date().toISOString(),
    favorite: Boolean(asset.favorite),
    lastUsedAt: asset.lastUsedAt,
    useCount: Math.max(0, Number(asset.useCount || 0))
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

function roleForTrack(project: ProjectFile, track: TimelineTrack, roles = projectRoles(project)): CharacterRole | undefined {
  return (
    roles.find((role) => role.defaultTrackId === track.id) ||
    roles.find((role) => track.name.includes(role.name)) ||
    roles[0]
  )
}

function makeSubtitleTrack(trackId = 'subtitles', name = '字幕'): TimelineTrack {
  return {
    id: trackId,
    name,
    kind: 'subtitle',
    groupId: 'subtitle',
    locked: false,
    muted: false
  }
}

function createSubtitleStreamItem(
  project: ProjectFile,
  trackId: string,
  totalFrames: number,
  options: {
    label?: string
    style?: Partial<ProjectFile['subtitleStyle']>
    binding?: TimelineItem['subtitleBinding']
    roleId?: string
    box?: Partial<SubtitleBox>
  } = {}
): TimelineItem {
  return {
    id: crypto.randomUUID(),
    trackId,
    roleId: options.roleId,
    type: 'subtitle',
    label: options.label || `字幕流 ${project.timeline.filter((item) => item.type === 'subtitle').length + 1}`,
    startFrame: 0,
    durationFrames: totalFrames,
    sourceInFrame: 0,
    playbackRate: 1,
    effects: [],
    subtitleCues: [],
    subtitleBox: normalizeSubtitleBox(options.box),
    subtitleBinding: options.binding,
    speakerVisible: false,
    speakerPosition: 'bottom',
    style: normalizeSubtitleStyleConfig({ ...project.subtitleStyle, ...options.style })
  }
}

function createRoleStreamItem(project: ProjectFile, track: TimelineTrack, totalFrames: number, role?: CharacterRole, asset?: Asset): TimelineItem {
  return {
    id: crypto.randomUUID(),
    trackId: track.id,
    roleId: role?.id,
    type: 'visual',
    label: role ? `${role.name} 角色流` : `${displayTrackName(track)} 角色流`,
    startFrame: 0,
    durationFrames: totalFrames,
    sourceInFrame: 0,
    playbackRate: 1,
    effects: defaultEffectsForTrackKind('visual'),
    volume: 1,
    transform: role?.defaultTransform || (asset ? defaultTransformForAsset(project, asset, track.id) : defaultTransformForTrack(project, track.id)),
    roleLabel: role ? createRoleLabel(role, true) : undefined,
    roleStates: []
  }
}

function createRoleLabel(role: CharacterRole, visible: boolean): NonNullable<TimelineItem['roleLabel']> {
  return {
    text: roleSpeakerLabel(role),
    visible,
    style: normalizeRoleLabelStyle({ position: role.speakerPosition })
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

function assetDisplayName(asset: Asset): string {
  return asset.title || asset.filename
}

function isBgmAsset(asset: Asset): boolean {
  const haystack = `${assetSearchText(asset)} ${(asset.localPath || '').replace(/\\/g, '/').toLowerCase()}`
  return ['bgm', 'music', 'background music', '配乐', '音乐', '背景音乐', '/music/'].some((token) => haystack.includes(token))
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
  if (category === 'favorite') return Boolean(asset.favorite)
  if (category === 'recent-used') return Boolean(asset.lastUsedAt || asset.useCount)
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
  return assetRecentTime(b) - assetRecentTime(a)
}

function assetUsageScore(asset: Asset): number {
  let score = 0
  if (asset.favorite) score += 80
  score += Math.min(70, (asset.useCount || 0) * 7)
  if (isGreenScreenAsset(asset)) score += 20
  if (hasNativeAudioHint(asset)) score += 12
  if (asset.type === 'video') score += 8
  if (asset.type === 'audio') score += 6
  score += Math.min(10, assetTags(asset).length)
  return score
}

function assetRecentTime(asset: Asset): number {
  return new Date(asset.lastUsedAt || asset.createdAt || 0).getTime()
}

function countAssetsForCategory(assets: Asset[], category: AssetPrimaryCategory): number {
  return assets.filter((asset) => assetMatchesPrimaryCategory(asset, category)).length
}

function assetBadges(asset: Asset): string[] {
  const badges = [assetTypeName(asset.type)]
  if (isGreenScreenAsset(asset)) badges.push('绿幕')
  if (greenAlphaVariant(asset)) badges.push('透明缓存')
  if (hasNativeAudioHint(asset)) badges.push('有声')
  if (asset.favorite) badges.push('收藏')
  if (asset.useCount) badges.push(`用过${asset.useCount}次`)
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

function emptyWaveformData(assetId: string): WaveformData {
  return { assetId, samples: [], peak: 0, mean: 0, createdAt: new Date().toISOString() }
}

function formatDurationSeconds(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))
  const minute = Math.floor(value / 60)
  const second = value % 60
  return minute ? `${minute}:${String(second).padStart(2, '0')}` : `${second}s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

function createNoneEffect(): TimelineItem['effects'][number] {
  return { ...DEFAULT_EFFECTS[0], id: crypto.randomUUID() }
}

function defaultEffectsForTrackKind(kind: TrackKind): TimelineItem['effects'] {
  return kind === 'visual' ? [createNoneEffect()] : []
}

function effectHint(effect: string): string {
  const hints: Record<string, string> = {
    none: '不添加动态效果。',
    'zoom-in': '轻微推近画面。',
    'zoom-out': '轻微拉远画面。',
    'pan-left': '画面向左移动。',
    'pan-right': '画面向右移动。',
    shake: '制造短促抖动。',
    flash: '叠加闪白冲击。'
  }
  return hints[effect] || '调整效果强度。'
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

function trackIdForAssetDrop(
  project: ProjectFile,
  asset: Asset,
  selectedItem: TimelineItem | null,
  requestedKind?: TrackKind,
  activeTool?: EditorToolId
): string {
  if (activeTool === 'sticker' && isVisualAsset(asset) && visualTargetGroupForAsset(asset) === 'effect') {
    return trackByGroupKind(project, 'effect', 'visual')?.id || trackIdForVisualAsset(project, asset, selectedItem)
  }
  if (activeTool === 'audio' && canUseAsAudioAsset(asset)) {
    return trackIdForKind(project, isBgmAsset(asset) ? 'music' : 'sfx', selectedItem)
  }
  if (requestedKind) {
    return requestedKind === 'visual' ? trackIdForVisualAsset(project, asset, selectedItem) : trackIdForKind(project, requestedKind, selectedItem)
  }
  if (asset.type === 'audio') {
    return trackIdForKind(project, isBgmAsset(asset) ? 'music' : 'sfx', selectedItem)
  }
  return trackIdForVisualAsset(project, asset, selectedItem)
}

function trackIdForVisualAsset(project: ProjectFile, asset: Asset, selectedItem: TimelineItem | null): string {
  const bottomTrackId = backgroundTrackId(project)
  if (isBackgroundAsset(asset)) return bottomTrackId
  const targetGroup = visualTargetGroupForAsset(asset)
  const selectedTrack = selectedItem?.type === 'visual' ? project.tracks.find((track) => track.id === selectedItem.trackId) : undefined
  if (selectedTrack?.kind === 'visual' && trackGroupId(selectedTrack) === targetGroup) return selectedTrack.id
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
  const cutState = visualAnimationStateAtFrame(item, cutFrame)
  const second = [
    {
      id: crypto.randomUUID(),
      frame: 0,
      x: Math.round(cutState.transform.x),
      y: Math.round(cutState.transform.y),
      scale: Number(cutState.transform.scale.toFixed(3)),
      rotation: Math.round(cutState.transform.rotation),
      opacity: Number(cutState.transform.opacity.toFixed(3)),
      ...(typeof cutState.effectIntensity === 'number' ? { effectIntensity: Number(cutState.effectIntensity.toFixed(3)) } : {})
    },
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
  return normalizeVisualTransform(transform)
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
  return getVisualKeyframes(item)
}

function visualTransformAtFrame(item: TimelineItem, localFrame: number): NormalizedTransform {
  return getVisualTransformAtFrame(item, localFrame)
}

function keyframeAtLocalFrame(item: TimelineItem, localFrame: number): VisualKeyframe | undefined {
  const frame = clampNumber(Math.round(localFrame), 0, Math.max(0, item.durationFrames - 1))
  return visualKeyframes(item).find((keyframe) => keyframe.frame === frame)
}

function patchVisualTransformAtFrame(item: TimelineItem, localFrame: number, patch: Partial<VisualTransform> & { effectIntensity?: number }): Partial<TimelineItem> {
  return patchVisualAnimationAtFrame(item, localFrame, patch)
}

function upsertVisualKeyframe(item: TimelineItem, localFrame: number, state = visualAnimationStateAtFrame(item, localFrame)): VisualKeyframe[] {
  return upsertSharedVisualKeyframe(item, localFrame, state, () => crypto.randomUUID())
}

function mergeVisualActionKeyframes(
  item: TimelineItem,
  actionFrames: Array<{ frame: number; transform: NormalizedTransform }>
): VisualKeyframe[] {
  return actionFrames.reduce(
    (keyframes, actionFrame) => upsertSharedVisualKeyframe({ ...item, keyframes }, actionFrame.frame, { transform: actionFrame.transform, effectIntensity: visualAnimationStateAtFrame(item, actionFrame.frame).effectIntensity }, () => crypto.randomUUID()),
    visualKeyframes(item)
  )
}

function removeVisualKeyframe(item: TimelineItem, localFrame: number): VisualKeyframe[] {
  return removeSharedVisualKeyframe(item, localFrame)
}

function moveVisualKeyframe(item: TimelineItem, keyframeId: string, localFrame: number): { keyframes: VisualKeyframe[]; frame: number } {
  return moveVisualKeyframeFrame(item, keyframeId, localFrame)
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

function normalizeSubtitleBox(box?: Partial<SubtitleBox>): SubtitleBox {
  const autoHeight = box?.autoHeight ?? true
  return {
    widthPct: clampNumber(box?.widthPct ?? 78, 18, 96),
    heightPct: autoHeight ? clampNumber(box?.heightPct ?? 18, 6, 92) : clampNumber(box?.heightPct ?? 18, 6, 92),
    autoHeight,
    padding: clampNumber(Math.round(box?.padding ?? 0), 0, 80),
    lineHeight: clampNumber(Number(box?.lineHeight ?? 1.12), 0.8, 2),
    textAlign: box?.textAlign || 'center',
    verticalAlign: box?.verticalAlign || 'middle',
    overflow: box?.overflow || 'wrap'
  }
}

function normalizeSubtitleCues(cues: TimelineItem['subtitleCues'], streamDurationFrames: number): SubtitleCue[] {
  if (!Array.isArray(cues)) return []
  return cues
    .map((cue, index) => {
      const startFrame = clampNumber(Math.round(cue.startFrame || 0), 0, Math.max(0, streamDurationFrames - 1))
      const durationFrames = clampNumber(Math.round(cue.durationFrames || 1), 1, Math.max(1, streamDurationFrames - startFrame))
      return {
        id: cue.id || crypto.randomUUID(),
        startFrame,
        durationFrames,
        text: cue.text ?? `Cue ${index + 1}`
      }
    })
    .sort((a, b) => a.startFrame - b.startFrame)
}

function normalizeRoleStates(states: TimelineItem['roleStates'], durationFrames: number): RoleStateCue[] {
  if (!Array.isArray(states)) return []
  return states
    .filter((state) => Boolean(state.assetId))
    .map((state) => {
      const startFrame = clampNumber(Math.round(state.startFrame || 0), 0, Math.max(0, durationFrames - 1))
      const duration = clampNumber(Math.round(state.durationFrames || 1), 1, Math.max(1, durationFrames - startFrame))
      return {
        id: state.id || crypto.randomUUID(),
        assetId: state.assetId,
        startFrame,
        durationFrames: duration,
        sourceInFrame: Math.max(0, Math.round(state.sourceInFrame || 0)),
        playbackRate: state.playbackRate,
        muted: state.muted ?? false,
        volume: clampNumber(state.volume ?? 1, 0, 2.5),
        scale: clampNumber(state.scale ?? 1, 0.08, 4),
        offsetX: Math.round(state.offsetX || 0),
        offsetY: Math.round(state.offsetY || 0),
        fitMode: state.fitMode || 'visible-bounds',
        label: state.label,
        keying: state.keying
      }
    })
    .sort((a, b) => a.startFrame - b.startFrame)
}

function isSubtitleStreamItem(item: TimelineItem): boolean {
  return item.type === 'subtitle' && Array.isArray(item.subtitleCues)
}

function isRoleInstanceItem(item: TimelineItem): boolean {
  return item.type === 'visual' && Array.isArray(item.roleStates)
}

function normalizeSubtitleBinding(binding?: TimelineItem['subtitleBinding']): TimelineItem['subtitleBinding'] | undefined {
  return binding?.roleId ? { roleId: binding.roleId, hideWhenRoleMissing: true } : undefined
}

function normalizeRoleLabelStyle(style?: Partial<ProjectFile['subtitleStyle']>): ProjectFile['subtitleStyle'] {
  return normalizeSubtitleStyleConfig({ ...DEFAULT_ROLE_LABEL_STYLE, ...upgradeLegacySubtitleStyle(style) })
}

function roleLabelForItem(project: ProjectFile | null, item: TimelineItem): { text: string; visible: boolean; style: ProjectFile['subtitleStyle'] } {
  const role = item.roleId && project ? projectRoles(project).find((entry) => entry.id === item.roleId) : undefined
  const fallbackText = role ? roleSpeakerLabel(role) : ''
  const fallbackPosition = role?.speakerPosition || DEFAULT_ROLE_LABEL_STYLE.position
  return {
    text: item.roleLabel?.text ?? fallbackText,
    visible: item.roleLabel?.visible ?? Boolean(item.roleLabel?.text?.trim()),
    style: normalizeRoleLabelStyle({ position: fallbackPosition, ...item.roleLabel?.style })
  }
}

function mergeRoleLabelPatch(
  project: ProjectFile | null,
  item: TimelineItem,
  patch: NonNullable<TimelineItem['roleLabel']>
): NonNullable<TimelineItem['roleLabel']> {
  const current = roleLabelForItem(project, item)
  return {
    text: patch.text ?? current.text,
    visible: patch.visible ?? current.visible,
    style: normalizeRoleLabelStyle({ ...current.style, ...patch.style })
  }
}

function previewSubtitleCss(style: ProjectFile['subtitleStyle'], box?: SubtitleBox, displayScale = 0.34): CSSProperties {
  const outline = style.outlineColor
  const subtitleBox = normalizeSubtitleBox(box)
  const fontSize = Math.max(10, Math.round(style.fontSize * displayScale))
  const padding = Math.round(subtitleBox.padding * displayScale)
  const outlineWidth = Math.max(1, Math.round(style.outlineWidth * displayScale))
  return {
    width: '100%',
    height: subtitleBox.autoHeight ? 'auto' : '100%',
    display: 'flex',
    alignItems: subtitleBox.verticalAlign === 'top' ? 'flex-start' : subtitleBox.verticalAlign === 'bottom' ? 'flex-end' : 'center',
    justifyContent: subtitleBox.textAlign === 'left' ? 'flex-start' : subtitleBox.textAlign === 'right' ? 'flex-end' : 'center',
    padding: `${padding}px`,
    fontFamily: style.fontFamily,
    color: style.color,
    fontSize: `${fontSize}px`,
    lineHeight: subtitleBox.lineHeight,
    textAlign: subtitleBox.textAlign,
    whiteSpace: 'pre-wrap',
    overflow: subtitleBox.overflow === 'clip' ? 'hidden' : 'visible',
    overflowWrap: 'anywhere',
    background: style.background ? style.backgroundColor : 'transparent',
    boxShadow: style.background ? `0 0 0 1px ${style.outlineColor}` : 'none',
    textShadow: [
      `${outlineWidth}px 0 0 ${outline}`,
      `-${outlineWidth}px 0 0 ${outline}`,
      `0 ${outlineWidth}px 0 ${outline}`,
      `0 -${outlineWidth}px 0 ${outline}`,
      `${outlineWidth}px ${outlineWidth}px 0 ${outline}`
    ].join(', ')
  }
}

function previewSpeakerCss(style: ProjectFile['subtitleStyle'], displayScale = 0.34): CSSProperties {
  const outline = '#111111'
  const fontSize = Math.max(10, Math.round(Math.max(30, style.fontSize * 0.58) * displayScale))
  const outlineWidth = Math.max(1, Math.round(2 * displayScale))
  return {
    fontFamily: style.fontFamily,
    fontSize: `${fontSize}px`,
    textShadow: [
      `${outlineWidth}px 0 0 ${outline}`,
      `-${outlineWidth}px 0 0 ${outline}`,
      `0 ${outlineWidth}px 0 ${outline}`,
      `0 -${outlineWidth}px 0 ${outline}`,
      `${outlineWidth}px ${outlineWidth}px 0 ${outline}`
    ].join(', ')
  }
}

function previewRoleLabelCss(style: ProjectFile['subtitleStyle'], transform: NormalizedTransform, displayScale = 0.34): CSSProperties {
  const outline = style.outlineColor
  const fontSize = Math.max(10, Math.round(style.fontSize * transform.scale * displayScale))
  const outlineWidth = Math.max(1, Math.round(style.outlineWidth * transform.scale * displayScale))
  return {
    fontFamily: style.fontFamily,
    color: style.color,
    fontSize: `${fontSize}px`,
    background: style.background ? style.backgroundColor : 'transparent',
    boxShadow: style.background ? `0 0 0 1px ${style.outlineColor}` : 'none',
    textShadow: [
      `${outlineWidth}px 0 0 ${outline}`,
      `-${outlineWidth}px 0 0 ${outline}`,
      `0 ${outlineWidth}px 0 ${outline}`,
      `0 -${outlineWidth}px 0 ${outline}`,
      `${outlineWidth}px ${outlineWidth}px 0 ${outline}`
    ].join(', '),
    transform: `scale(${transform.flipX ? -1 : 1}, ${transform.flipY ? -1 : 1})`
  }
}

function isGreenScreenAsset(asset: Asset): boolean {
  const haystack = `${asset.filename} ${asset.title || ''} ${assetTags(asset).join(' ')}`.toLowerCase()
  return haystack.includes('绿幕') || haystack.includes('green') || haystack.includes('chroma')
}

function greenAlphaVariant(asset: Asset): NonNullable<Asset['processedVariants']>[number] | undefined {
  return asset.processedVariants?.find((variant) => variant.kind === 'green-alpha' && Boolean(variant.fileUrl || variant.localPath))
}

function roleCueImageSrc(asset: Asset): string {
  const alphaVariant = greenAlphaVariant(asset)
  if (alphaVariant?.format === 'png' && alphaVariant.fileUrl) return alphaVariant.fileUrl
  if ((asset.type === 'image' || asset.type === 'gif') && asset.fileUrl) return asset.fileUrl
  const cached = greenThumbFrameCache.get(asset.fileUrl || asset.localPath || asset.id)
  return cached || ''
}

function visibleBodyHeightUnit(asset?: Asset | null): number {
  const bounds = asset ? greenAlphaVariant(asset)?.visibleBounds : undefined
  return bounds?.height && bounds.height > 0 ? bounds.height : 1
}

function defaultRoleStateScale(asset: Asset, previousAsset?: Asset, previousState?: RoleStateCue): number {
  if (!previousAsset || !previousState) return 1
  return clampNumber((previousState.scale ?? 1) * (visibleBodyHeightUnit(previousAsset) / visibleBodyHeightUnit(asset)), 0.08, 4)
}

function mediaReady(media: HTMLVideoElement | HTMLImageElement): boolean {
  if (media instanceof HTMLVideoElement) return media.readyState >= 2 && media.videoWidth > 0 && media.videoHeight > 0
  return media.complete && media.naturalWidth > 0 && media.naturalHeight > 0
}

function drawKeyedFrame(
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | HTMLImageElement,
  keying: ReturnType<typeof normalizeKeying>,
  measureBounds = true
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
    if (measureBounds && data[index + 3] > 12) {
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
  if (!measureBounds) return null
  if (maxX < minX || maxY < minY) return null
  return {
    left: minX / canvas.width,
    top: minY / canvas.height,
    width: (maxX - minX + 1) / canvas.width,
    height: (maxY - minY + 1) / canvas.height
  }
}

function drawAlphaFrame(canvas: HTMLCanvasElement, media: HTMLVideoElement | HTMLImageElement, measureBounds = true): VisibleBounds | null {
  const context = canvas.getContext('2d', { willReadFrequently: measureBounds })
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
  try {
    context.drawImage(media, x, y, drawWidth, drawHeight)
  } catch {
    return null
  }
  if (!measureBounds) return null

  let image: ImageData
  try {
    image = context.getImageData(0, 0, canvas.width, canvas.height)
  } catch {
    return null
  }
  const data = image.data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1

  // Keep the visual layer full-size and only shrink the hitbox, so export coordinates stay aligned with preview.
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] <= 12) continue
    const pixel = (index - 3) / 4
    const px = pixel % canvas.width
    const py = Math.floor(pixel / canvas.width)
    if (px < minX) minX = px
    if (py < minY) minY = py
    if (px > maxX) maxX = px
    if (py > maxY) maxY = py
  }
  if (maxX < minX || maxY < minY) return null
  return {
    left: minX / canvas.width,
    top: minY / canvas.height,
    width: (maxX - minX + 1) / canvas.width,
    height: (maxY - minY + 1) / canvas.height
  }
}

function isUsefulForegroundBounds(
  bounds: VisibleBounds,
  minimums: { minWidth: number; minHeight: number; minArea: number } = { minWidth: 0.02, minHeight: 0.02, minArea: 0.0006 }
): boolean {
  return bounds.width >= minimums.minWidth && bounds.height >= minimums.minHeight && bounds.width * bounds.height >= minimums.minArea
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
      if (bounds && isUsefulForegroundBounds(bounds, { minWidth: 0.08, minHeight: 0.08, minArea: 0.012 })) {
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

function createTimelineLookup(project: ProjectFile): TimelineLookup {
  const trackOrder = new Map(project.tracks.map((track, index) => [track.id, index]))
  const timelineOrder = new Map(project.timeline.map((item, index) => [item.id, index]))
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]))
  const visibleTrackIdsByScope = new Map<TrackGroupId | 'all', Set<string>>()
  const itemsByType = new Map<TrackKind, TimelineItem[]>()

  visibleTrackIdsByScope.set('all', new Set(project.tracks.filter((track) => !track.muted).map((track) => track.id)))
  TRACK_GROUPS.forEach((group) => {
    visibleTrackIdsByScope.set(
      group.id,
      new Set(project.tracks.filter((track) => !track.muted && trackGroupId(track) === group.id).map((track) => track.id))
    )
  })
  project.timeline.forEach((item) => {
    const items = itemsByType.get(item.type) || []
    items.push(item)
    itemsByType.set(item.type, items)
  })

  const visualItems = (itemsByType.get('visual') || []).sort(
    (a, b) => (trackOrder.get(a.trackId) ?? 0) - (trackOrder.get(b.trackId) ?? 0) || (timelineOrder.get(a.id) ?? 0) - (timelineOrder.get(b.id) ?? 0)
  )
  const previewAudioItems = project.timeline.filter((item) => {
    if (!item.assetId) return false
    if (['voice', 'music', 'sfx'].includes(item.type)) return true
    const asset = assetsById.get(item.assetId)
    return item.type === 'visual' && asset?.type === 'video' && (item.volume ?? 1) > 0
  })

  return { trackOrder, timelineOrder, assetsById, visibleTrackIdsByScope, visualItems, previewAudioItems, itemsByType }
}

function visibleTrackIdsForScope(lookup: TimelineLookup, soloGroup?: TrackGroupId | null): Set<string> {
  return lookup.visibleTrackIdsByScope.get(soloGroup || 'all') || lookup.visibleTrackIdsByScope.get('all') || new Set()
}

function findActiveVisualItems(lookup: TimelineLookup | null, frame: number, soloGroup?: TrackGroupId | null): TimelineItem[] {
  if (!lookup) return []
  const visibleTracks = visibleTrackIdsForScope(lookup, soloGroup)
  return lookup.visualItems
    .filter((item) => visibleTracks.has(item.trackId) && frame >= item.startFrame && frame < item.startFrame + item.durationFrames)
    .flatMap((item) => expandRoleInstanceForPreview(item, frame))
}

function findActiveSubtitleItems(lookup: TimelineLookup | null, frame: number, soloGroup?: TrackGroupId | null): TimelineItem[] {
  if (!lookup) return []
  const visibleTracks = visibleTrackIdsForScope(lookup, soloGroup)
  return (lookup.itemsByType.get('subtitle') || [])
    .filter((item) => visibleTracks.has(item.trackId))
    .flatMap((item) => expandSubtitleStreamForPreview(item, frame, lookup.visualItems))
    .filter((item) => frame >= item.startFrame && frame < item.startFrame + item.durationFrames)
}

function findPreviewAudioItems(lookup: TimelineLookup | null, frame: number, soloGroup?: TrackGroupId | null): TimelineItem[] {
  if (!lookup) return []
  const audibleTracks = visibleTrackIdsForScope(lookup, soloGroup)
  return lookup.previewAudioItems.filter((item) => audibleTracks.has(item.trackId) && frame >= item.startFrame && frame < item.startFrame + item.durationFrames)
}

function expandSubtitleStreamForPreview(item: TimelineItem, frame: number, visualItems: TimelineItem[]): TimelineItem[] {
  if (!isSubtitleStreamItem(item)) return [item]
  const cues = normalizeSubtitleCues(item.subtitleCues, item.durationFrames)
  const binding = normalizeSubtitleBinding(item.subtitleBinding)
  const roleAnchorTransform = binding?.roleId ? subtitleRoleAnchorTransform(item, visualItems, binding.roleId, frame) : null
  if (binding?.roleId && !roleAnchorTransform) return []
  return cues
    .filter((cue) => {
      const start = item.startFrame + cue.startFrame
      return frame >= start && frame < start + cue.durationFrames
    })
    .map((cue) => ({
      ...item,
      id: item.id,
      label: `${item.label} · ${cue.text.slice(0, 16)}`,
      startFrame: item.startFrame + cue.startFrame,
      durationFrames: cue.durationFrames,
      text: cue.text,
      style: roleAnchorTransform ? { ...item.style, position: 'middle' as const } : item.style,
      transform: roleAnchorTransform ? mergeSubtitleRoleTransform(item.transform, roleAnchorTransform) : item.transform,
      subtitleCues: item.subtitleCues,
      subtitleBox: normalizeSubtitleBox(item.subtitleBox)
    }))
}

function subtitleRoleAnchorTransform(item: TimelineItem, visualItems: TimelineItem[], roleId: string, frame: number): NormalizedTransform | null {
  const roleItem = visualItems.find((entry) => {
    if (entry.roleId !== roleId) return false
    if (frame < entry.startFrame || frame >= entry.startFrame + entry.durationFrames) return false
    return isRoleInstanceItem(entry) ? Boolean(activeRoleStateAt(entry, frame - entry.startFrame)) : true
  })
  if (!roleItem) return null
  const roleTransform = visualAnimationStateAtFrame(roleItem, localFrameForItem(roleItem, frame)).transform
  const style = normalizeSubtitleStyleConfig(item.style)
  const offsetY = style.position === 'top' ? -130 * roleTransform.scale : style.position === 'bottom' ? 120 * roleTransform.scale : 0
  return { ...roleTransform, y: roleTransform.y + offsetY, scale: 1, rotation: roleTransform.rotation }
}

function mergeSubtitleRoleTransform(subtitleTransform: TimelineItem['transform'], roleAnchor: NormalizedTransform): TimelineItem['transform'] {
  const transform = normalizeTransform(subtitleTransform)
  return {
    ...transform,
    x: roleAnchor.x + transform.x,
    y: roleAnchor.y + transform.y,
    rotation: roleAnchor.rotation + transform.rotation
  }
}

function expandRoleInstanceForPreview(item: TimelineItem, frame: number): TimelineItem[] {
  if (!isRoleInstanceItem(item)) return [item]
  const localFrame = frame - item.startFrame
  const state = activeRoleStateAt(item, localFrame)
  if (!state) return []
  const animationState = visualAnimationStateAtFrame(item, clampNumber(localFrame, 0, Math.max(0, item.durationFrames - 1)))
  const roleStateTransform = applyRoleStateDisplayTransform(animationState.transform, state)
  return [
    {
      ...item,
      assetId: state.assetId,
      label: state.label || item.label,
      startFrame: item.startFrame + state.startFrame,
      durationFrames: state.durationFrames,
      sourceInFrame: state.sourceInFrame || 0,
      playbackRate: state.playbackRate ?? item.playbackRate,
      volume: state.muted ? 0 : (item.volume ?? 1) * (state.volume ?? 1),
      transform: roleStateTransform,
      keying: state.keying || item.keying,
      roleStates: undefined
    }
  ]
}

function activeRoleStateAt(item: TimelineItem, localFrame: number): RoleStateCue | null {
  if (!isRoleInstanceItem(item)) return null
  return normalizeRoleStates(item.roleStates, item.durationFrames).find((state) => localFrame >= state.startFrame && localFrame < state.startFrame + state.durationFrames) || null
}

function applyRoleStateDisplayTransform(transform: NormalizedTransform, state: RoleStateCue): NormalizedTransform {
  return {
    ...transform,
    x: transform.x + Math.round(state.offsetX || 0),
    y: transform.y + Math.round(state.offsetY || 0),
    scale: clampNumber(transform.scale * (state.scale ?? 1), 0.08, 4)
  }
}

function resolveRoleStateOverlaps(states: RoleStateCue[], focusId: string, durationFrames: number): RoleStateCue[] {
  const focus = states.find((state) => state.id === focusId)
  if (!focus) return normalizeRoleStates(states, durationFrames)
  const focusStart = clampNumber(focus.startFrame, 0, Math.max(0, durationFrames - 1))
  const focusEnd = clampNumber(focus.startFrame + focus.durationFrames, focusStart + 1, durationFrames)
  const clipped = states.flatMap((state) => {
    if (state.id === focusId) return [{ ...state, startFrame: focusStart, durationFrames: focusEnd - focusStart }]
    const start = state.startFrame
    const end = state.startFrame + state.durationFrames
    if (end <= focusStart || start >= focusEnd) return [state]
    const parts: RoleStateCue[] = []
    if (start < focusStart) parts.push({ ...state, durationFrames: focusStart - start })
    if (end > focusEnd) parts.push({ ...state, id: crypto.randomUUID(), startFrame: focusEnd, durationFrames: end - focusEnd })
    return parts
  })
  return normalizeRoleStates(clipped, durationFrames)
}

function roleStateGaps(states: RoleStateCue[], durationFrames: number): Array<{ startFrame: number; durationFrames: number }> {
  const normalized = normalizeRoleStates(states, durationFrames)
  const gaps: Array<{ startFrame: number; durationFrames: number }> = []
  let cursor = 0
  normalized.forEach((state) => {
    if (state.startFrame > cursor) gaps.push({ startFrame: cursor, durationFrames: state.startFrame - cursor })
    cursor = Math.max(cursor, state.startFrame + state.durationFrames)
  })
  if (cursor < durationFrames) gaps.push({ startFrame: cursor, durationFrames: durationFrames - cursor })
  return gaps
}

function fillRoleStateGaps(states: RoleStateCue[], durationFrames: number): RoleStateCue[] {
  const normalized = normalizeRoleStates(states, durationFrames)
  if (!normalized.length) return []
  return normalized.map((state, index) => {
    const next = normalized[index + 1]
    return {
      ...state,
      durationFrames: (next ? next.startFrame : durationFrames) - state.startFrame
    }
  })
}

function subtitleCueConflictIds(cues: SubtitleCue[]): Set<string> {
  const conflicts = new Set<string>()
  cues.forEach((cue, index) => {
    const start = cue.startFrame
    const end = cue.startFrame + cue.durationFrames
    cues.forEach((other, otherIndex) => {
      if (otherIndex <= index) return
      const otherStart = other.startFrame
      const otherEnd = other.startFrame + other.durationFrames
      if (start < otherEnd && otherStart < end) {
        conflicts.add(cue.id)
        conflicts.add(other.id)
      }
    })
  })
  return conflicts
}

function canMoveItemToTrack(project: ProjectFile, item: TimelineItem, trackId: string): boolean {
  const track = project.tracks.find((track) => track.id === trackId)
  if (!track || track.locked || track.kind !== item.type) return false
  if (isSubtitleStreamItem(item)) return track.kind === 'subtitle'
  if (isRoleInstanceItem(item)) return track.kind === 'visual' && trackGroupId(track) === 'role'
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
  if (groupId === 'role') return !isBackgroundAsset(asset)
  if (targetGroup === 'background') return groupId === 'background'
  if (targetGroup === 'role') return false
  if (targetGroup === 'effect') return groupId === 'effect'
  return false
}

function assetDropBlockedMessage(asset: Asset, track: TimelineTrack): string {
  if (track.locked) return `${displayTrackName(track)} 已锁定，不能投放素材`
  if (!canPlaceAssetOnTrack(asset, track.kind)) {
    if (track.kind === 'subtitle') return '媒体素材不能直接投放到字幕轨'
    if (track.kind === 'visual') return `${assetDisplayName(asset)} 不是可投放到画面轨的素材`
    return `${assetDisplayName(asset)} 不是可投放到音频轨的素材`
  }
  if (track.kind === 'visual') {
    return `${assetDisplayName(asset)} 更适合投放到 ${trackGroupLabel(visualTargetGroupForAsset(asset))} 轨`
  }
  return `${assetDisplayName(asset)} 不能投放到 ${displayTrackName(track)}`
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

function buildRateStretchPatch(
  item: TimelineItem,
  assets: Asset[],
  startFrame: number,
  durationFrames: number,
  nextStartFrame: number,
  nextDurationFrames: number,
  edge: 'start' | 'end'
): Partial<TimelineItem> {
  const safeDuration = Math.max(1, Math.round(nextDurationFrames))
  const fixedEndFrame = startFrame + durationFrames
  if (!isRateStretchItem(item, assets)) {
    return edge === 'start'
      ? { startFrame: Math.max(0, Math.round(nextStartFrame)), durationFrames: Math.max(1, fixedEndFrame - Math.max(0, Math.round(nextStartFrame))) }
      : { durationFrames: safeDuration }
  }

  const sourceDurationFrames = Math.max(1, durationFrames * itemPlaybackRate(item))
  const minDurationFrames = Math.max(1, Math.ceil(sourceDurationFrames / MAX_PLAYBACK_RATE))
  const maxDurationFrames = Math.max(minDurationFrames, Math.floor(sourceDurationFrames / MIN_PLAYBACK_RATE))
  const stretchedDurationFrames = clampNumber(safeDuration, minDurationFrames, maxDurationFrames)
  const playbackRate = clampNumber(sourceDurationFrames / stretchedDurationFrames, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE)
  const patch: Partial<TimelineItem> = {
    durationFrames: stretchedDurationFrames,
    playbackRate: Number(playbackRate.toFixed(3))
  }

  // Rate stretch keeps the source in-point stable and moves only the dragged edge.
  if (edge === 'start') {
    patch.startFrame = Math.max(0, fixedEndFrame - stretchedDurationFrames)
  }
  return patch
}

function snapTimelinePatch({
  project,
  item,
  mode,
  patch,
  startFrame,
  durationFrames,
  trackId,
  playheadFrame,
  rulerFrames,
  thresholdFrames
}: {
  project: ProjectFile
  item: TimelineItem
  mode: 'move' | 'rate-start' | 'rate-end'
  patch: Partial<TimelineItem>
  startFrame: number
  durationFrames: number
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

  if (mode === 'rate-start') {
    const nextStart = patch.startFrame ?? startFrame
    const snapStart = nearest(nextStart)
    if (snapStart === null) return patch
    const maxStart = startFrame + durationFrames - 1
    const appliedStart = clampNumber(snapStart, 0, maxStart)
    const delta = appliedStart - startFrame
    return {
      ...patch,
      startFrame: appliedStart,
      durationFrames: Math.max(1, durationFrames - delta)
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
  if (['voice', 'music', 'sfx'].includes(kind)) return canUseAsAudioAsset(asset)
  return false
}

function canUseAsAudioAsset(asset: Asset): boolean {
  return asset.type === 'audio' || (asset.type === 'video' && hasNativeAudioHint(asset))
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

function findActiveItem(lookup: TimelineLookup | null, frame: number, type: TrackKind, soloGroup?: TrackGroupId | null): TimelineItem | null {
  if (!lookup) return null
  const visibleTracks = visibleTrackIdsForScope(lookup, soloGroup)
  return (
    (lookup.itemsByType.get(type) || [])
      .filter((item) => visibleTracks.has(item.trackId) && frame >= item.startFrame && frame < item.startFrame + item.durationFrames)
      .sort((a, b) => b.startFrame - a.startFrame)[0] || null
  )
}

function projectContentEndFrame(project: ProjectFile): number {
  return project.timeline.reduce((max, item) => Math.max(max, item.startFrame + item.durationFrames), 0)
}

function secondsFromFrames(frames: number, fps: number): number {
  return Math.max(0, Math.round((frames / Math.max(1, fps)) * 1000) / 1000)
}

function normalizeProjectDurationSeconds(project: ProjectFile, fps: number): number {
  const contentSeconds = secondsFromFrames(projectContentEndFrame(project), fps)
  const requestedSeconds = Number(project.durationSeconds)
  const fallbackSeconds = Math.max(10, contentSeconds)
  return Math.max(contentSeconds, Number.isFinite(requestedSeconds) && requestedSeconds > 0 ? requestedSeconds : fallbackSeconds)
}

function projectDurationFrames(project: ProjectFile, fps: number): number {
  return Math.max(projectContentEndFrame(project), Math.round(normalizeProjectDurationSeconds(project, fps) * fps), fps)
}

function isRoleNameOnlySubtitle(item: TimelineItem): boolean {
  return item.type === 'subtitle' && item.speakerVisible !== false && !item.text?.trim() && Boolean(item.speakerName?.trim())
}

function isTimelineCountItem(item: TimelineItem): boolean {
  return !isRoleNameOnlySubtitle(item)
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
