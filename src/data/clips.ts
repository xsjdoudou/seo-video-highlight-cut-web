import generated from './clips.generated.json'

export type Platform = 'youtube' | 'instagram' | 'linkedin' | 'tiktok' | 'facebook' | 'x'

export type ScoreBreakdown = {
  hook: number
  value: number
  emotion: number
  standalone: number
  quotability: number
  clarity: number
}

type GeneratedSource = (typeof generated.sources)[number]
type GeneratedClip = GeneratedSource['clips'][number]

export type Clip = GeneratedClip & {
  title: string
  platform: Platform
  scores: ScoreBreakdown
}

export type Source = Omit<GeneratedSource, 'clips'> & {
  title: string
  lang: 'zh' | 'en'
  clips: Clip[]
}

/** Shown under the long-video player, and used as the alt text for the source. */
const SOURCE_TITLES: Record<string, string> = {
  yt_test_2: 'Zuckerberg on AI, loneliness and the next computing platform',
  bili_test_4: 'AI 原生组织：传统公司如何跨过认知鸿沟',
  bili_test_3: '大模型的终局：寡头、壁垒与 Agent 的落地难题',
  bili_test_2: '阿里战略复盘：从淘宝、支付宝到阿里云',
  fenglun: '冯仑：商业、人生与「我尽力了」',
  shangban: '上班这件事：稳定的错觉与职业激活',
  jogg_1: '当神明隐居现代都市：一次故事创作对谈',
  tk_test_12: '大学生创业实录：烧烤店、法餐厅与水果摊',
}

/**
 * Card copy, keyed by `<sourceKey>:<clipId>`. Written by hand from each clip's
 * transcript_summary in the pipeline's top10.json, in the language actually
 * spoken in that video.
 */
const COPY: Record<string, { title: string; platform: Platform }> = {
  'yt_test_2:h01': { title: 'The loneliness numbers nobody talks about', platform: 'youtube' },
  'yt_test_2:h02': { title: "AI's trillion-dollar bet: does scaling ever stop?", platform: 'instagram' },
  'yt_test_2:h05': { title: 'Why AI should keep some of the struggle', platform: 'linkedin' },
  'yt_test_2:h07': { title: 'Open-source AI is safer because everyone checks it', platform: 'tiktok' },
  'yt_test_2:h08': { title: "Tech isn't what's making us lonely", platform: 'facebook' },
  'yt_test_2:h10': { title: 'The next computing platform feels natural', platform: 'x' },

  'bili_test_4:h01': { title: '不换脑袋就换人：转型为什么这么难', platform: 'youtube' },
  'bili_test_4:h02': { title: '人类对智能的垄断，正在终结', platform: 'instagram' },
  'bili_test_4:h03': { title: 'AI 时代，组织的基本单元是任务而非岗位', platform: 'linkedin' },
  'bili_test_4:h04': { title: '公司制度会衰亡，但组织永远不会消失', platform: 'tiktok' },
  'bili_test_4:h05': { title: '一人公司只是过渡，未来人人都是全能节点', platform: 'facebook' },
  'bili_test_4:h06': { title: 'AI 泡沫是好事：重赏之下才有勇夫', platform: 'x' },

  'bili_test_3:h01': { title: '大模型基础设施的窗口，已经关上了', platform: 'youtube' },
  'bili_test_3:h02': { title: '简单 Agent 没有长期价值，壁垒在复杂任务', platform: 'instagram' },
  'bili_test_3:h03': { title: 'Agent 遇冷：行业从「过家家」进入严肃落地', platform: 'linkedin' },
  'bili_test_3:h04': { title: '头部效应变成黑洞，智能复利拉开差距', platform: 'tiktok' },
  'bili_test_3:h05': { title: 'Anthropic 领跑、Google 落后、Meta 退赛', platform: 'facebook' },
  'bili_test_3:h06': { title: '模型公司的终局：像水电一样被强监管', platform: 'x' },

  'bili_test_2:h01': { title: '复盘阿里三场生死战：淘宝、支付宝、阿里云', platform: 'youtube' },
  'bili_test_2:h02': { title: '优秀不等于卓越：卓越来自被验证的反共识', platform: 'instagram' },
  'bili_test_2:h03': { title: 'AI 正从信息时代进入能力时代', platform: 'linkedin' },
  'bili_test_2:h04': { title: '移动互联网的第二阶段，没人能跳过', platform: 'tiktok' },
  'bili_test_2:h06': { title: '科层制会消失，因为上班实在不开心', platform: 'facebook' },
  'bili_test_2:h07': { title: '巨头没有先例可循，但生死本是常态', platform: 'x' },

  'fenglun:h01': { title: '我的商业墓志铭，四个字：我尽力了', platform: 'youtube' },
  'fenglun:h02': { title: '什么是一号位：造势、扛事、买单', platform: 'instagram' },
  'fenglun:h03': { title: '不争即争：无名老者为何能四两拨千斤', platform: 'linkedin' },
  'fenglun:h04': { title: '考公与创业，对「标准答案」的两种态度', platform: 'tiktok' },
  'fenglun:h05': { title: '名利生死都不可控，尽力就是圆满', platform: 'facebook' },
  'fenglun:h06': { title: '创业的终局：价值判断只能来自你自己', platform: 'x' },

  'shangban:h01': { title: '越稳定越可替代：月薪正在让你变穷', platform: 'youtube' },
  'shangban:h05': { title: '上班是赎身，不是当头牌', platform: 'instagram' },
  'shangban:h06': { title: '在职场要有主场感：练习跳槽，练习老板思维', platform: 'linkedin' },
  'shangban:h07': { title: '「厌蠢」：对思维激荡的那点偏执', platform: 'tiktok' },
  'shangban:h09': { title: '职业激活四要素，解决 90% 的职场问题', platform: 'facebook' },
  'shangban:h10': { title: '把恐惧从 what if 换成 even if', platform: 'x' },

  'jogg_1:h01': { title: '落魄神明住进单身公寓，高潮来自最平凡的乞求', platform: 'youtube' },
  'jogg_1:h02': { title: '为什么是他被选中：他能看穿生命的伪装', platform: 'instagram' },
  'jogg_1:h03': { title: '指挥女神在图书馆，战神在当保安', platform: 'linkedin' },
  'jogg_1:h04': { title: '神话在现代城市重生，给冷硬都市一点温情', platform: 'tiktok' },
  'jogg_1:h05': { title: '这份新工作，是遗忘的祈祷与厌倦的神之间的桥', platform: 'facebook' },
  'jogg_1:h06': { title: '神明隐居都市，而主角是那个信使', platform: 'x' },

  'tk_test_12:h01': { title: '19 岁开烧烤店：7 万启动，46 天回本', platform: 'youtube' },
  'tk_test_12:h03': { title: '00 后在三里屯开法餐厅：从缺钱到爆单', platform: 'instagram' },
  'tk_test_12:h04': { title: '三天卖出 60 盒番茄乌梅：先验证需求再开卖', platform: 'linkedin' },
  'tk_test_12:h05': { title: '大学生开水果店：熬夜进货，用赚钱衡量值不值', platform: 'tiktok' },
  'tk_test_12:h06': { title: '第二家店专门用来教学，让学员的成功验证方法论', platform: 'facebook' },
  'tk_test_12:h07': { title: '第二个月稳定出单，五个月纯利 35 万', platform: 'x' },
}

const FALLBACK_PLATFORMS: Platform[] = ['youtube', 'instagram', 'linkedin', 'tiktok', 'facebook', 'x']

export const sources: Source[] = generated.sources.map((src) => ({
  ...src,
  lang: src.lang === 'en' ? 'en' : 'zh',
  title: SOURCE_TITLES[src.key] ?? src.key,
  clips: src.clips.map((clip, i) => {
    const copy = COPY[`${src.key}:${clip.id}`]
    return {
      ...clip,
      title: copy?.title ?? clip.type,
      platform: copy?.platform ?? FALLBACK_PLATFORMS[i % FALLBACK_PLATFORMS.length],
    }
  }),
}))

/** Index of a random source other than `exclude`, so replays always change. */
export function pickSourceIndex(exclude = -1): number {
  if (sources.length < 2) return 0
  let i = exclude
  while (i === exclude) i = Math.floor(Math.random() * sources.length)
  return i
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
