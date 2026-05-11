import type { CatMemeTemplate } from './types'

export const CAT_MEME_TEMPLATES: CatMemeTemplate[] = [
  {
    id: 'workplace-cat-roast',
    name: '打工猫吐槽',
    description: '猫猫用严肃表情吐槽上班、开会和加班，节奏快，适合中文短视频。',
    tags: ['打工人', '吐槽', '反差'],
    defaultSceneSeconds: [2.2, 2.0, 2.4, 2.2, 2.6],
    subtitleStyle: {
      fontFamily: 'Microsoft YaHei',
      fontSize: 56,
      color: '#ffffff',
      outlineColor: '#000000',
      outlineWidth: 3,
      position: 'top',
      background: false,
      backgroundColor: '#111827'
    },
    effects: [
      { id: 'fx-zoom', type: 'zoom-in', intensity: 0.32 },
      { id: 'fx-shake', type: 'shake', intensity: 0.24 },
      { id: 'fx-flash', type: 'flash', intensity: 0.18 }
    ],
    prompt:
      '生成一条中文猫 meme 竖屏短视频脚本。主题是打工人吐槽，语气要像猫猫一本正经地发疯。输出标题、5句字幕，每句10到18个字，最后一句要有反转。'
  },
  {
    id: 'cat-emotional-drama',
    name: '猫猫情绪剧场',
    description: '用夸张字幕和慢放营造猫猫内心戏，适合可爱和委屈素材。',
    tags: ['内心戏', '委屈', '可爱'],
    defaultSceneSeconds: [2.6, 2.6, 2.8, 3.0],
    subtitleStyle: {
      fontFamily: 'Microsoft YaHei',
      fontSize: 70,
      color: '#ffe96a',
      outlineColor: '#151515',
      outlineWidth: 5,
      position: 'bottom',
      background: false,
      backgroundColor: '#111827'
    },
    effects: [
      { id: 'fx-pan', type: 'pan-right', intensity: 0.22 },
      { id: 'fx-zoom-out', type: 'zoom-out', intensity: 0.2 }
    ],
    prompt:
      '生成一条中文猫 meme 情绪短剧脚本。猫猫像在演内心独白，情绪从委屈到突然清醒。输出标题和4句字幕，每句不超过18个字。'
  },
  {
    id: 'chaos-cat-cut',
    name: '猫猫发疯卡点',
    description: '高频切镜、闪白、抖动和音效点，适合夸张表情包和 GIF。',
    tags: ['卡点', '发疯', '鬼畜'],
    defaultSceneSeconds: [1.4, 1.2, 1.4, 1.1, 1.3, 1.8],
    subtitleStyle: {
      fontFamily: 'Microsoft YaHei',
      fontSize: 76,
      color: '#ffffff',
      outlineColor: '#000000',
      outlineWidth: 6,
      position: 'middle',
      background: false,
      backgroundColor: '#111827'
    },
    effects: [
      { id: 'fx-shake-hard', type: 'shake', intensity: 0.44 },
      { id: 'fx-flash-hard', type: 'flash', intensity: 0.28 },
      { id: 'fx-zoom-hard', type: 'zoom-in', intensity: 0.38 }
    ],
    prompt:
      '生成一条中文猫 meme 发疯卡点脚本。风格短促、有梗、像弹幕吐槽。输出标题和6句字幕，每句6到14个字。'
  }
]
