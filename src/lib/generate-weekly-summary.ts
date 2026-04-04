import Anthropic from '@anthropic-ai/sdk'

export type DailyLogForSummary = {
  date: string
  events: string | null
  feelings: string | null
  achievements: string | null
  tags: string[]
  mood_score: number | null
}

export type MoodChartEntry = {
  date: string
  day: string
  score: number | null
}

export type WeeklySummaryContent = {
  mood_chart: MoodChartEntry[]
  emotion_summary: string
  notable_events: { date: string; content: string }[]
  achievements: string[]
  insight: string | null
  encouragement: string
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

export async function generateWeeklySummary(
  logs: DailyLogForSummary[]
): Promise<WeeklySummaryContent> {
  const moodChart: MoodChartEntry[] = logs.map((log) => {
    const d = new Date(log.date + 'T00:00:00')
    return {
      date: log.date,
      day: DAY_NAMES[d.getDay()],
      score: log.mood_score,
    }
  })

  const logsText = logs
    .map((log) => {
      const d = new Date(log.date + 'T00:00:00')
      const dayName = DAY_NAMES[d.getDay()]
      const month = d.getMonth() + 1
      const day = d.getDate()
      return `【${month}/${day}（${dayName}）】
- 出来事: ${log.events ?? 'なし'}
- 気持ち: ${log.feelings ?? 'なし'}
- できたこと: ${log.achievements ?? 'なし'}
- タグ: ${log.tags.length > 0 ? log.tags.map((t) => `#${t}`).join(' ') : 'なし'}`
    })
    .join('\n\n')

  const hasEnoughData = logs.length >= 3

  const prompt = `# 役割
あなたは、障害児育児をしている親の1週間の記録を振り返り、やさしく整理するアシスタントです。

# 目的
ユーザーが「自分の1週間を客観的に理解できた」と感じること。
評価や分析ではなく、寄り添いながら気づきを提供する。

# 入力（日付順）
${logsText}

# 出力形式
以下のJSON形式のみで返してください（説明文は不要）:
${
  hasEnoughData
    ? `{
  "emotion_summary": "全体の感情傾向を80〜120字でやさしくまとめる。週の前後の変化にも触れる。断定しすぎない。",
  "notable_events": [
    {"date": "M/D", "content": "感情の起伏が大きかった、またはお子さんの変化が見られた出来事。80字以内。"}
  ],
  "achievements": ["具体的なできたこと・成長を1つずつ。80字以内。"],
  "insight": "この週のパターンや傾向を1つだけ。80〜100字。押しつけがましくなく。",
  "encouragement": "自然で過剰でないねぎらい。1〜2文。"
}`
    : `{
  "emotion_summary": "全体の感情傾向を80字以内でやさしくまとめる。",
  "notable_events": [],
  "achievements": [],
  "insight": null,
  "encouragement": "自然で過剰でないねぎらい。1〜2文。"
}`
}

notable_events は2〜3件。achievements は2〜3件。

# トーン
- やさしい・人間らしい・抽象すぎない
- NG: 説教・アドバイス・過剰なポジティブ・長すぎる文章`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  if (!rawText) throw new Error('Empty response from Claude')

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in Claude response')

  const parsed = JSON.parse(jsonMatch[0])
  return { ...parsed, mood_chart: moodChart }
}
