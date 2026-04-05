import Anthropic from '@anthropic-ai/sdk'
import type { DailyLogForSummary } from './generate-weekly-summary'

export type MonthlySummaryContent = {
  summary: string              // 1ヶ月の感情の流れ・サマリー文
  child_growth: string         // 子どもの成長まとめ
  child_difficulties: string   // 子どもの特性・困りごとまとめ（相談用）
  top_tags: string[]           // よく出たタグ上位5件
  encouragement: string        // ねぎらいメッセージ
}

function countTags(logs: DailyLogForSummary[]): string[] {
  const freq: Record<string, number> = {}
  for (const log of logs) {
    for (const tag of log.tags) {
      freq[tag] = (freq[tag] ?? 0) + 1
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag)
}

export async function generateMonthlySummary(
  logs: DailyLogForSummary[]
): Promise<MonthlySummaryContent> {
  const topTags = countTags(logs)

  const logsText = logs
    .map((log) => {
      const d = new Date(log.date + 'T00:00:00')
      const month = d.getMonth() + 1
      const day = d.getDate()
      return `【${month}/${day}】
- 出来事: ${log.events ?? 'なし'}
- 気持ち: ${log.feelings ?? 'なし'}
- できたこと: ${log.achievements ?? 'なし'}
- 困りごと: ${log.difficulties ?? 'なし'}
- タグ: ${log.tags.length > 0 ? log.tags.map((t) => `#${t}`).join(' ') : 'なし'}`
    })
    .join('\n\n')

  const prompt = `# 役割
あなたは、障害児育児をしている親の1ヶ月の記録を振り返り、やさしく整理するアシスタントです。

# 目的
ユーザーが「自分の1ヶ月を客観的に理解できた」と感じること。
評価や分析ではなく、寄り添いながら気づきを提供する。

# 入力（日付順、合計${logs.length}件）
${logsText}

# 出力形式
以下のJSON形式のみで返してください（説明文は不要）:
{
  "summary": "1ヶ月全体の感情の流れをやさしくまとめる。月の前半・後半の変化にも触れる。120〜180字。",
  "child_growth": "お子さんの成長・できたことを中心に、具体的にまとめる。100〜150字。記録がない場合は空文字。",
  "child_difficulties": "この1ヶ月に繰り返し出てきた子どもの特性・困りごとをまとめる（こだわり、感覚過敏、癇癪、睡眠、言葉・コミュニケーション、切り替えの難しさなど）。医療・療育機関や先生に伝えやすい表現で、具体的に150〜200字。記録がない場合は空文字。",
  "encouragement": "1ヶ月間のねぎらいメッセージ。自然で過剰でない。1〜2文。"
}

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
  return { ...parsed, top_tags: topTags }
}
