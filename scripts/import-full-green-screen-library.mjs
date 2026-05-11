import crypto from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const rawArgs = process.argv.slice(2)
const dryRun = rawArgs.includes('--dry-run')
const root = valueAfter('--root') || process.env.CAT_MEME_HOME || 'D:\\cat_meme'
const videoLimit = Math.max(0, Number.parseInt(valueAfter('--limit') || valueAfter('--video-limit') || '48', 10) || 0)
const sourceRoot =
  valueAfter('--source') ||
  path.join(root, '资源', '猫meme素材合集', '猫meme绿幕素材 2000个', '00.热门常用猫meme素材【B站的在这】')
const targetRoot = path.join(root, 'assets', 'videos', 'green-screen')
const indexPath = path.join(root, 'data', 'assets.index.json')

const categoryRules = [
  {
    key: 'banana-cat',
    label: '香蕉猫',
    tags: ['香蕉猫', 'banana-cat'],
    patterns: ['香蕉', 'banana']
  },
  {
    key: 'crying-sad',
    label: '哭泣委屈',
    tags: ['哭猫', '哭泣', '委屈', 'sad'],
    patterns: ['哭', '委屈', '大哭', '忧伤', '忧愁', '绝望', '难过']
  },
  {
    key: 'shock-scream',
    label: '震惊大叫',
    tags: ['震惊', '大叫', '尖叫', 'reaction'],
    patterns: ['震惊', '大叫', '尖叫', '怒吼', '啊哇', '嗷呜', '目瞪口呆', 'huh']
  },
  {
    key: 'angry-fight',
    label: '生气打架',
    tags: ['生气', '愤怒', '打架', 'angry'],
    patterns: ['生气', '愤怒', '骂人', '打架', '打手', '霸总', '严肃']
  },
  {
    key: 'happy-funny',
    label: '开心搞笑',
    tags: ['开心', '搞笑', '笑', 'funny'],
    patterns: ['happy', '开心', '傻笑', '大笑', '坏笑', '尬笑', '笑', 'chipi', 'oiiai']
  },
  {
    key: 'dance-move',
    label: '跳舞动作',
    tags: ['跳舞', '动作', 'dance'],
    patterns: ['跳舞', '摇', '旋转', '甩动', '跑步', '走路', '花手', '舞']
  },
  {
    key: 'life-scene',
    label: '生活动作',
    tags: ['生活动作', '吃喝睡', 'scene'],
    patterns: ['吃', '喝', '舔', '打嗝', '睡', '瞌睡', '开车', '打电话', '工作', '数钱']
  },
  {
    key: 'dialogue-reaction',
    label: '对话反应',
    tags: ['对话', '反应', 'dialogue'],
    patterns: ['质问', '疑惑', '听八卦', '采访', '客服', '名字', '你笑什么']
  },
  {
    key: 'other-characters',
    label: '其他角色',
    tags: ['其他角色', '配角'],
    patterns: ['狗', 'dog', '羊', '鸭子', '企鹅', '土拨鼠', '痞老板', '大司马']
  }
]

const defaultCategory = {
  key: 'general-cat',
  label: '通用猫',
  tags: ['通用猫', 'general'],
  patterns: []
}

function valueAfter(flag) {
  const index = rawArgs.indexOf(flag)
  return index >= 0 ? rawArgs[index + 1] : undefined
}

function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex')
}

function sanitizeFilePart(value) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, maxChars) {
  const chars = Array.from(value)
  return chars.length > maxChars ? chars.slice(0, maxChars).join('') : value
}

function cleanTitle(fileName) {
  return (
    path
      .parse(fileName)
      .name.replace(/[【\[]高清无水印[】\]]/g, '')
      .replace(/[【\[]高清[】\]]/g, '')
      .replace(/猫?meme绿幕素材/gi, '')
      .replace(/meme素材/gi, '')
      .replace(/绿幕素材/gi, '')
      .replace(/素材合集\d*个?/g, '')
      .replace(/\d+\s*秒(?:循环)?/g, '')
      .replace(/\d+\s*分钟/g, '')
      .replace(/[ _-]+$/g, '')
      .trim() || path.parse(fileName).name
  )
}

function categoryFor(file) {
  const haystack = `${file.name} ${file.relative}`.toLowerCase()
  return categoryRules.find((rule) => rule.patterns.some((pattern) => haystack.includes(pattern.toLowerCase()))) || defaultCategory
}

function allMatchingTags(file) {
  const haystack = `${file.name} ${file.relative}`.toLowerCase()
  const tags = []
  for (const rule of categoryRules) {
    if (rule.patterns.some((pattern) => haystack.includes(pattern.toLowerCase()))) {
      tags.push(rule.label, ...rule.tags)
    }
  }
  return [...new Set(tags)]
}

function sourceBucket(relative) {
  const first = relative.split(path.sep)[0] || '热门常用'
  if (sourceRoot.includes('00.热门常用猫meme素材') || first.startsWith('00.')) return '热门常用'
  if (first.startsWith('01.')) return '素材合集1'
  if (first.startsWith('02.')) return '素材合集2'
  return first
}

function priorityFor(relative) {
  if (sourceRoot.includes('00.热门常用猫meme素材') || relative.startsWith('00.')) return 0
  if (!relative.includes(path.sep)) return 1
  if (relative.startsWith('01.')) return 2
  if (relative.startsWith('02.')) return 3
  return 4
}

function estimateDurationSeconds(name) {
  const minute = name.match(/(\d+)\s*分钟/)
  if (minute) return Number(minute[1]) * 60
  const seconds = name.match(/(\d+)\s*秒/)
  if (seconds) return Number(seconds[1])
  return undefined
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...(await walk(fullPath)))
    } else if (entry.isFile() && /\.(mp4|mov|webm)$/i.test(entry.name)) {
      const info = await stat(fullPath)
      result.push({
        fullPath,
        name: entry.name,
        length: info.size,
        mtime: info.mtime,
        relative: path.relative(sourceRoot, fullPath)
      })
    }
  }
  return result
}

function dedupe(files) {
  const groups = new Map()
  for (const file of files) {
    const key = `${file.name.toLowerCase()}|${file.length}`
    const group = groups.get(key) || []
    group.push(file)
    groups.set(key, group)
  }
  return [...groups.values()].map((group) =>
    group.sort((a, b) => priorityFor(a.relative) - priorityFor(b.relative) || a.relative.localeCompare(b.relative, 'zh-CN'))[0]
  )
}

function assetFor(file, targetPath, category) {
  const hash = sha1(file.relative).slice(0, 12)
  const bucket = sourceBucket(file.relative)
  const tags = [
    'cat-meme',
    'green-screen',
    '绿幕',
    '抠像素材',
    'resource',
    bucket,
    category.label,
    ...category.tags,
    ...allMatchingTags(file),
    file.name.includes('有声') ? '有声' : '',
    file.name.includes('无声') ? '无声' : ''
  ].filter(Boolean)

  const asset = {
    id: `resource-green-${hash}`,
    type: 'video',
    filename: path.basename(targetPath),
    localPath: targetPath,
    sourceUrl: file.fullPath,
    provider: 'local',
    license: '用户本地/公开资源素材',
    riskLevel: 'safe',
    tags: [...new Set(tags)],
    title: cleanTitle(file.name),
    createdAt: file.mtime.toISOString()
  }
  const duration = estimateDurationSeconds(file.name)
  if (duration) asset.duration = duration
  return asset
}

async function readAssetIndex() {
  if (!existsSync(indexPath)) return []
  try {
    const raw = (await readFile(indexPath, 'utf8')).replace(/^\uFEFF/, '')
    return raw.trim() ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function normalizeForCompare(value) {
  return path.normalize(value || '').toLowerCase()
}

function isGreenScreenLibraryAsset(asset) {
  const localPath = normalizeForCompare(asset.localPath)
  const sourceUrl = normalizeForCompare(asset.sourceUrl)
  return localPath.startsWith(normalizeForCompare(targetRoot)) || sourceUrl.startsWith(normalizeForCompare(sourceRoot))
}

async function main() {
  if (!existsSync(sourceRoot)) {
    throw new Error(`找不到绿幕素材目录：${sourceRoot}`)
  }

  const files = await walk(sourceRoot)
  const uniqueFiles = dedupe(files).sort((a, b) => a.relative.localeCompare(b.relative, 'zh-CN'))
  const selectedFiles = videoLimit > 0 ? uniqueFiles.slice(0, videoLimit) : uniqueFiles

  console.log(`Found ${files.length} hot green-screen videos, ${uniqueFiles.length} unique after dedupe, importing ${selectedFiles.length}.`)
  console.log(`Target: ${targetRoot}`)
  if (dryRun) return

  await mkdir(targetRoot, { recursive: true })
  await mkdir(path.dirname(indexPath), { recursive: true })

  const newAssets = []
  let copied = 0
  let reused = 0
  for (const [index, file] of selectedFiles.entries()) {
    const category = categoryFor(file)
    const categoryDir = path.join(targetRoot, category.key)
    await mkdir(categoryDir, { recursive: true })
    const ext = path.extname(file.name)
    const baseName = truncate(sanitizeFilePart(path.basename(file.name, ext)), 82)
    const targetPath = path.join(categoryDir, `green-${sha1(file.relative).slice(0, 10)}-${baseName}${ext.toLowerCase()}`)
    if (!existsSync(targetPath)) {
      await copyFile(file.fullPath, targetPath)
      copied += 1
    } else {
      reused += 1
    }
    newAssets.push(assetFor(file, targetPath, category))
    if ((index + 1) % 50 === 0 || index + 1 === selectedFiles.length) {
      console.log(`Indexed ${index + 1}/${selectedFiles.length}`)
    }
  }

  const existing = await readAssetIndex()
  const kept = existing.filter((asset) => !isGreenScreenLibraryAsset(asset))
  const finalAssets = [...newAssets, ...kept]
  await writeFile(indexPath, `${JSON.stringify(finalAssets, null, 2)}\n`, 'utf8')

  const byCategory = newAssets.reduce((map, asset) => {
    const category = asset.tags.find((tag) => categoryRules.some((rule) => rule.label === tag)) || defaultCategory.label
    map[category] = (map[category] || 0) + 1
    return map
  }, {})

  console.log(`Copied ${copied}, reused ${reused}, indexed ${newAssets.length}.`)
  console.log('Categories:')
  for (const [category, count] of Object.entries(byCategory).sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))) {
    console.log(` - ${category}: ${count}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
