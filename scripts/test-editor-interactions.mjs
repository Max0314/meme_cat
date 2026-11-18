import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSourceLoader, fixtureProject } from './test-support.mjs'

// A hook/event harness exercises editor actions without a DOM, browser or Electron.
function editorHarness() {
  const slots = []
  let cursor = 0
  let dirty = true
  let effects = []
  let tree
  let component
  let projectNumber = 0
  const listeners = new Map()
  const calls = { saves: [], closes: 0, loads: 0, settings: [] }
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const hooks = {
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (update) => {
        const next = typeof update === 'function' ? update(slots[index].value) : update
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true }
      }]
    },
    useRef(initial) {
      const index = cursor++
      return slots[index] ||= { current: initial }
    },
    useMemo(fn, deps) {
      const index = cursor++
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { deps, value: fn() }
      return slots[index].value
    },
    useEffect(fn, deps) {
      const index = cursor++
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        const previous = slots[index]
        slots[index] = { deps }
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn() })
      }
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps) },
    memo: (fn) => fn
  }
  const api = {
    workspaceInfo: async () => ({ root: 'test-workspace', outputDir: 'test-output' }),
    getSettings: async () => ({ workspaceRoot: '', appearance: 'light', defaultPresetId: 'douyin-1080p', openAi: {}, providers: {} }),
    listPresets: async () => [{ id: 'douyin-1080p', fps: 30, width: 1080, height: 1920 }],
    listTemplates: async () => [], listAssets: async () => [], listAssetLibraries: async () => [],
    newProject: async () => fixtureProject(`new-${++projectNumber}`),
    loadProject: async () => { calls.loads++; return { project: fixtureProject('loaded', '打开的工程'), filePath: 'loaded.json' } },
    saveProject: (project) => new Promise((resolve, reject) => calls.saves.push({ project, resolve, reject })),
    saveSettings: async (settings) => { calls.settings.push(settings); return settings },
    onRenderProgress: () => () => {}, onGreenScreenPreprocessProgress: () => () => {}
  }
  globalThis.document = { documentElement: { dataset: {} }, activeElement: null }
  globalThis.HTMLElement = class { tagName = 'INPUT'; isContentEditable = false }
  globalThis.window = {
    catMeme: api, innerWidth: 1180, innerHeight: 760,
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn) },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn) },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    close() { calls.closes++ }
  }
  const jsx = (type, props) => ({ type, props: props || {} })
  const load = createSourceLoader({ react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' } })
  const source = load('src/renderer/src/App.tsx', ['normalizeProject', 'AssetGrid', 'createTimelineLookup', 'findPreviewAudioItems', 'findActiveVisualItems'])
  component = source.default
  function all(node) {
    if (Array.isArray(node)) return node.flatMap((child) => all(child))
    if (!node || typeof node !== 'object') return []
    return [node, ...all(node.props?.children)]
  }
  const find = (predicate) => all(tree).find(predicate)
  const button = (text) => find((node) => node.type === 'button' && node.props.children === text)
  async function flush() {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (dirty) {
        cursor = 0; dirty = false; effects = []
        tree = component()
        for (const effect of effects) effect()
      }
      await new Promise((resolve) => setImmediate(resolve))
      if (!dirty) return
    }
    throw new Error('Editor failed to settle')
  }
  return {
    calls, api, source, hooks, flush, all, find, button,
    setComponent(fn) { component = fn; dirty = true },
    rerender() { dirty = true },
    icon(title) { return find((node) => node.type?.name === 'IconButton' && node.props.title === title) },
    title() { return find((node) => node.type === 'input').props.value },
    editTitle(value) { find((node) => node.type === 'input').props.onChange({ target: { value } }) },
    event(name, args = {}) {
      const event = { code: '', preventDefault() { this.prevented = true }, ...args }
      for (const fn of listeners.get(name) || []) fn(event)
      return event
    },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); delete globalThis.window; delete globalThis.document; delete globalThis.HTMLElement }
  }
}

test('save shortcut works inside text fields; saving preserves newer edits, failed save blocks navigation and discard explicitly replaces the project', async () => {
  const editor = editorHarness()
  try {
    await editor.flush()
    editor.editTitle('submitted'); await editor.flush()
    assert.equal(editor.event('keydown', { ctrlKey: true, code: 'KeyS', target: new HTMLElement() }).prevented, true)
    await editor.flush()
    assert.equal(editor.calls.saves.length, 1)
    editor.editTitle('edited while saving'); await editor.flush()
    editor.calls.saves[0].resolve({ project: editor.calls.saves[0].project, filePath: 'saved.json' })
    await editor.flush()
    assert.equal(editor.title(), 'edited while saving')
    editor.icon('新建工程').props.onClick(); await editor.flush()
    assert.ok(editor.find((node) => node.props.role === 'dialog'))
    editor.button('保存后继续').props.onClick(); await editor.flush()
    editor.calls.saves[1].reject(new Error('disk full')); await editor.flush()
    assert.equal(editor.title(), 'edited while saving')
    assert.ok(editor.find((node) => node.props.role === 'dialog'))
    editor.button('放弃修改').props.onClick(); await editor.flush()
    assert.equal(editor.title(), '测试工程')
    assert.equal(editor.find((node) => node.props.role === 'dialog'), undefined)
  } finally { editor.cleanup() }
})

test('dirty close is deferred; cancelling preserves the project and saving successfully allows closing', async () => {
  const editor = editorHarness()
  try {
    await editor.flush()
    editor.editTitle('unsaved'); await editor.flush()
    assert.equal(editor.event('beforeunload').prevented, true); await editor.flush()
    assert.equal(editor.calls.closes, 0)
    editor.button('取消').props.onClick(); await editor.flush()
    assert.equal(editor.title(), 'unsaved')
    editor.event('beforeunload'); await editor.flush()
    editor.button('保存后继续').props.onClick(); await editor.flush()
    editor.calls.saves[0].resolve({ project: editor.calls.saves[0].project, filePath: 'saved.json' }); await editor.flush()
    assert.equal(editor.calls.closes, 1)
    assert.equal(editor.event('beforeunload').prevented, undefined)
  } finally { editor.cleanup() }
})

test('custom-FPS project normalization preserves subtitle stream duration', async () => {
  const editor = editorHarness()
  try {
    const project = fixtureProject()
    project.exportPresetId = 'custom'
    project.customExportPreset = { fps: 60 }
    project.tracks.push({ id: 'subtitles', name: '字幕', kind: 'subtitle', locked: false, muted: false })
    project.timeline.push({ id: 'stream', trackId: 'subtitles', type: 'subtitle', subtitleCues: [], startFrame: 0, durationFrames: 600, sourceInFrame: 0, effects: [], label: '字幕流' })
    assert.equal(editor.source.normalizeProject(project).timeline[0].durationFrames, 600)
    editor.api.newProject = async () => project
    await editor.flush()
    assert.equal(editor.find((node) => node.type?.name === 'Timeline').props.project.durationSeconds, 10)
  } finally { editor.cleanup() }
})

test('immutable history preserves prior clips and assets through repeated edits, undo/redo and locked command attempts', async () => {
  const editor = editorHarness()
  try {
    const project = fixtureProject()
    project.assets = [{ id: 'image', type: 'image', filename: 'image.png', localPath: 'image.png', tags: [] }]
    project.timeline = [{ id: 'clip', assetId: 'image', trackId: 'visual-main', type: 'visual', startFrame: 0, durationFrames: 90, sourceInFrame: 0, label: 'original', effects: [] }]
    editor.api.newProject = async () => project
    await editor.flush()
    const timeline = () => editor.find((node) => node.type?.name === 'Timeline').props
    const original = timeline().project
    timeline().onSelect('clip'); await editor.flush()
    timeline().onPatchItem('clip', { label: 'first edit' }); await editor.flush()
    const first = timeline().project
    timeline().onPatchItem('clip', { label: 'second edit' }); await editor.flush()
    assert.equal(original.timeline[0].label, 'original')
    assert.equal(first.timeline[0].label, 'first edit')
    assert.equal(timeline().project.assets, original.assets)
    editor.event('keydown', { ctrlKey: true, code: 'KeyZ' }); await editor.flush()
    assert.equal(timeline().project.timeline[0].label, 'first edit')
    editor.event('keydown', { ctrlKey: true, code: 'KeyY' }); await editor.flush()
    assert.equal(timeline().project.timeline[0].label, 'second edit')
    timeline().onPatchTrack('visual-main', { locked: true }); await editor.flush()
    timeline().onSeek(30); await editor.flush()
    for (const event of [{ code: 'Delete' }, { ctrlKey: true, code: 'KeyD' }, { code: 'KeyB' }]) {
      editor.event('keydown', event); await editor.flush()
      assert.equal(timeline().project.timeline.length, 1)
      assert.equal(timeline().project.timeline[0].durationFrames, 90)
      assert.equal(timeline().selectedItemId, 'clip')
    }
    timeline().onPatchItem('clip', { label: 'blocked edit' }); await editor.flush()
    assert.equal(timeline().project.timeline[0].label, 'second edit')
  } finally { editor.cleanup() }
})

test('theme toggle persists the setting and updates the renderer theme without changing project edits', async () => {
  const editor = editorHarness()
  try {
    await editor.flush()
    editor.editTitle('keep my edit'); await editor.flush()
    await editor.icon('切换深色模式').props.onClick(); await editor.flush()
    assert.equal(editor.calls.settings[0].appearance, 'dark')
    assert.equal(document.documentElement.dataset.theme, 'dark')
    assert.equal(editor.title(), 'keep my edit')
    editor.api.saveSettings = async () => { throw new Error('write failed') }
    await editor.icon('切换浅色模式').props.onClick(); await editor.flush()
    assert.equal(document.documentElement.dataset.theme, 'dark')
  } finally { editor.cleanup() }
})

test('asset paging survives metadata updates but resets for a changed filter', async () => {
  const editor = editorHarness()
  let assets = Array.from({ length: 200 }, (_, index) => ({ id: `${index}` }))
  let resetKey = 'all'
  try {
    editor.setComponent(() => editor.source.AssetGrid({ assets, resetKey, viewMode: 'grid' }))
    await editor.flush()
    editor.find((node) => node.props.title === '下一页').props.onClick(); await editor.flush()
    const pageBefore = editor.find((node) => node.props.className === 'asset-pager').props.children[1].props.children
    assets = assets.map((asset) => ({ ...asset, favorite: true }))
    editor.rerender(); await editor.flush()
    assert.deepEqual(editor.find((node) => node.props.className === 'asset-pager').props.children[1].props.children, pageBefore)
    resetKey = 'filtered'
    editor.rerender(); await editor.flush()
    assert.equal(editor.find((node) => node.props.title === '上一页').props.disabled, true)
  } finally { editor.cleanup() }
})

test('timeline filtering preserves complete preview while explicit solo consistently isolates role audio', async () => {
  const editor = editorHarness()
  try {
    const project = fixtureProject()
    project.tracks.push({ id: 'role', kind: 'visual', groupId: 'role', name: '角色', muted: false, locked: false })
    project.assets = [{ id: 'cat', type: 'video', localPath: 'cat.mp4', filename: 'cat.mp4', tags: [] }]
    project.timeline = [{ id: 'role-stream', type: 'visual', trackId: 'role', startFrame: 0, durationFrames: 300, sourceInFrame: 0, effects: [], roleStates: [{ id: 'state', startFrame: 0, durationFrames: 100, assetId: 'cat', sourceInFrame: 15, playbackRate: 0.5, volume: 0.8 }] }]
    const lookup = editor.source.createTimelineLookup(project)
    assert.equal(editor.source.findPreviewAudioItems(lookup, 10)[0].sourceInFrame, 15)
    assert.equal(editor.source.findPreviewAudioItems(lookup, 10, 'background').length, 0)
    assert.equal(editor.source.findPreviewAudioItems(lookup, 10, 'role')[0].playbackRate, 0.5)
    project.tracks[1].muted = true
    assert.equal(editor.source.findPreviewAudioItems(editor.source.createTimelineLookup(project), 10).length, 0)
    // App category navigation must not supply the category as a solo scope.
    editor.api.newProject = async () => structuredClone({ ...project, tracks: project.tracks.map((track) => ({ ...track, muted: false })) })
    await editor.flush()
    const timeline = editor.find((node) => node.type?.name === 'Timeline')
    assert.ok(timeline)
    const previewBefore = editor.find((node) => node.type?.name === 'QuickPreview').props.items.length
    timeline.props.onActiveGroupChange('background'); await editor.flush()
    assert.equal(editor.find((node) => node.type?.name === 'QuickPreview').props.items.length, previewBefore)
  } finally { editor.cleanup() }
})

test('concurrent external copies append to the latest timeline; a late copy cannot insert into a different project', async () => {
  const editor = editorHarness()
  const pendingCopies = []
  const external = (id) => ({ id, type: 'image', localPath: `${id}.png`, filename: `${id}.png`, provider: 'external', tags: ['背景'], availability: 'available', source: { kind: 'external' } })
  const copy = (asset) => ({ ...asset, id: `managed-${asset.id}`, provider: 'local', source: { kind: 'managed' } })
  try {
    editor.api.materializeAsset = (id) => new Promise((resolve) => pendingCopies.push({ id, resolve }))
    editor.api.updateAsset = async (id, patch) => ({ ...copy(external(id.replace('managed-', ''))), ...patch })
    await editor.flush()
    const library = () => editor.find((node) => node.type?.name === 'AssetLibraryPanel').props
    const first = library().onAdd(external('a'))
    const second = library().onAdd(external('b'))
    pendingCopies[0].resolve(copy(external('a'))); await first; await editor.flush()
    pendingCopies[1].resolve(copy(external('b'))); await second; await editor.flush()
    const timeline = () => editor.find((node) => node.type?.name === 'Timeline').props.project
    assert.equal(timeline().timeline.length, 2)
    assert.deepEqual(new Set(timeline().timeline.map((item) => item.assetId)), new Set(['managed-a', 'managed-b']))
    editor.icon('新建工程').props.onClick(); await editor.flush()
    editor.button('放弃修改').props.onClick(); await editor.flush()
    const late = library().onAdd(external('late'))
    editor.icon('新建工程').props.onClick(); await editor.flush()
    const activeId = timeline().id
    pendingCopies[2].resolve(copy(external('late'))); await late; await editor.flush()
    assert.equal(timeline().id, activeId)
    assert.equal(timeline().timeline.length, 0)
  } finally { editor.cleanup() }
})

test('preprocessing failures release controls and successful refreshes retain mounted external assets', async () => {
  const editor = editorHarness()
  const green = { id: 'green', type: 'image', localPath: 'green.png', filename: 'green.png', provider: 'local', tags: ['绿幕'] }
  const external = { id: 'external', type: 'image', localPath: 'external.png', filename: 'external.png', provider: 'external', source: { kind: 'external' }, tags: [] }
  try {
    editor.api.listAssets = async () => [green, external]
    editor.api.preprocessGreenScreen = async () => { throw new Error('index unavailable') }
    await editor.flush()
    const library = () => editor.find((node) => node.type?.name === 'AssetLibraryPanel').props
    await library().onPreprocessGreen(); await editor.flush()
    assert.equal(library().preprocessProgress, null)
    editor.api.preprocessGreenScreen = async () => ({ assets: [green], success: 1, failed: 0, skipped: 0 })
    await library().onPreprocessGreen(); await editor.flush()
    assert.equal(library().localAssets.some((asset) => asset.id === external.id), true)
    assert.equal(library().preprocessProgress.success, 1)
  } finally { editor.cleanup() }
})

function configureAssistant(editor) {
  const template = { id: 'test-template', name: '测试模板', description: '分镜', tags: [], defaultSceneSeconds: [1, 2], subtitleStyle: fixtureProject().subtitleStyle, effects: [], prompt: 'script prompt' }
  editor.api.listTemplates = async () => [template]
  editor.api.getSettings = async () => ({ workspaceRoot: '', appearance: 'light', openAi: { apiKey: 'test-placeholder', ttsVoice: 'coral' }, providers: {} })
  const panel = () => editor.find((node) => node.type?.name === 'AssistantPanel').props
  const timeline = () => editor.find((node) => node.type?.name === 'Timeline').props
  return { template, panel, timeline, async open() { await editor.flush(); editor.icon('AI 与模板').props.onClick(); await editor.flush() } }
}

test('AI generation is deduplicated and staged; applying uses latest project state and can be undone', async () => {
  const editor = editorHarness()
  const { panel, timeline, open } = configureAssistant(editor)
  const requests = []
  try {
    editor.api.generateScript = (request) => new Promise((resolve, reject) => requests.push({ request, resolve, reject }))
    await open()
    panel().onChange({ topic: '主题', seconds: 22 }); await editor.flush()
    const pending = panel().onGenerate()
    await panel().onGenerate()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].request.seconds, 22)
    editor.editTitle('edited during generation'); await editor.flush()
    requests[0].resolve({ title: 'AI title', script: '完整草稿', subtitles: ['第一句', '第二句'] }); await pending; await editor.flush()
    assert.equal(editor.title(), 'edited during generation')
    assert.equal(timeline().project.script, '')
    assert.equal(panel().state.draft.script, '第一句\n第二句')
    timeline().onPatchTrack('visual-main', { name: 'manual track edit' }); await editor.flush()
    panel().onApplyDraft(); await editor.flush()
    assert.equal(timeline().project.tracks[0].name, 'manual track edit')
    assert.equal(timeline().project.aiRecords.length, 1)
    panel().onApplyDraft(); await editor.flush()
    assert.equal(timeline().project.aiRecords.length, 1)
    editor.event('keydown', { ctrlKey: true, code: 'KeyZ' }); await editor.flush()
    assert.equal(editor.title(), 'edited during generation')
    assert.equal(timeline().project.script, '')
    const retry = panel().onGenerate()
    requests[1].reject(new Error('provider unavailable')); await retry; await editor.flush()
    assert.equal(panel().busy, null)
    assert.equal(panel().state.draft.script, '第一句\n第二句')
  } finally { editor.cleanup() }
})

test('AI draft from a previous project remains reviewable but cannot be applied after a project switch', async () => {
  const editor = editorHarness()
  const { panel, timeline, open } = configureAssistant(editor)
  let resolve
  try {
    editor.api.generateScript = () => new Promise((done) => { resolve = done })
    await open()
    const operation = panel().onGenerate()
    editor.icon('新建工程').props.onClick(); await editor.flush()
    resolve({ title: 'old response', script: 'old text', subtitles: [] }); await operation; await editor.flush()
    assert.equal(panel().canApplyDraft, false)
    panel().onApplyDraft(); await editor.flush()
    assert.equal(editor.title(), '测试工程')
    assert.equal(timeline().project.script, '')
    assert.equal(panel().state.draft.script, 'old text')
  } finally { editor.cleanup() }
})

test('TTS adds exact-duration audio without replacing existing voice or newer edits; late results stay in the library', async () => {
  const editor = editorHarness()
  const { panel, timeline, open } = configureAssistant(editor)
  const requests = []
  const asset = { id: 'tts-audio', type: 'audio', filename: 'tts.mp3', localPath: 'tts.mp3', duration: 2.5, tags: ['tts'], provider: 'ai' }
  try {
    editor.api.newProject = async () => {
      const project = fixtureProject()
      project.tracks.push({ id: 'voice', name: '已有配音', kind: 'voice', groupId: 'sfx', locked: true, muted: false })
      project.timeline.push({ id: 'old-voice', type: 'voice', trackId: 'voice', startFrame: 0, durationFrames: 20, sourceInFrame: 0, label: 'old', effects: [] })
      return project
    }
    editor.api.tts = (request) => new Promise((resolve, reject) => requests.push({ request, resolve, reject }))
    await open()
    panel().onChange({ voiceText: '请朗读这句话', voice: 'coral' }); await editor.flush()
    timeline().onSeek(30); await editor.flush()
    const operation = panel().onVoice()
    await panel().onVoice()
    assert.equal(requests.length, 1)
    editor.editTitle('new edit while speaking'); await editor.flush()
    requests[0].resolve(asset); await operation; await editor.flush()
    assert.equal(editor.title(), 'new edit while speaking')
    assert.equal(timeline().project.timeline.length, 2)
    const voice = timeline().project.timeline.find((item) => item.assetId === asset.id)
    assert.equal(voice.startFrame, 30)
    assert.equal(voice.durationFrames, 75)
    assert.notEqual(voice.trackId, 'voice')
    editor.icon('新建工程').props.onClick(); await editor.flush()
    editor.button('放弃修改').props.onClick(); await editor.flush()
    panel().onChange({ voiceText: '另一句话' }); await editor.flush()
    const late = panel().onVoice()
    editor.icon('新建工程').props.onClick(); await editor.flush()
    const sessionId = timeline().project.id
    requests[1].resolve({ ...asset, id: 'late-voice' }); await late; await editor.flush()
    assert.equal(timeline().project.id, sessionId)
    assert.equal(timeline().project.timeline.some((item) => item.assetId === 'late-voice'), false)
    assert.equal(editor.find((node) => node.type?.name === 'AssetLibraryPanel').props.localAssets.some((entry) => entry.id === 'late-voice'), true)
  } finally { editor.cleanup() }
})

test('template insertion preserves existing clips on locked tracks and is one undoable edit', async () => {
  const editor = editorHarness()
  const { panel, timeline, template, open } = configureAssistant(editor)
  try {
    const asset = { id: 'scene', type: 'image', filename: 'scene.png', localPath: 'scene.png', tags: ['背景'], provider: 'local' }
    editor.api.listAssets = async () => [asset]
    editor.api.newProject = async () => {
      const project = fixtureProject()
      project.tracks[0].locked = true
      project.timeline.push({ id: 'old', type: 'visual', trackId: 'visual-main', startFrame: 0, durationFrames: 10, sourceInFrame: 0, label: 'original', effects: [] })
      project.script = '一句\n二句'
      return project
    }
    await open()
    panel().onChange({ assetIds: ['scene'] }); await editor.flush()
    timeline().onSeek(45); await editor.flush()
    await panel().onTemplate(template); await editor.flush()
    assert.equal(timeline().project.timeline.length, 5)
    assert.equal(timeline().project.timeline[0].id, 'old')
    const inserted = timeline().project.timeline.filter((item) => item.id !== 'old')
    assert.equal(Math.min(...inserted.map((item) => item.startFrame)), 45)
    assert.deepEqual(inserted.filter((item) => item.type === 'subtitle').map((item) => item.text), ['一句', '二句'])
    assert.equal(inserted.some((item) => item.trackId === 'visual-main'), false)
    editor.event('keydown', { ctrlKey: true, code: 'KeyZ' }); await editor.flush()
    assert.equal(timeline().project.timeline.length, 1)
    assert.equal(timeline().project.tracks.length, 1)
  } finally { editor.cleanup() }
})
