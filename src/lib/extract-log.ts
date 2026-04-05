import Anthropic from '@anthropic-ai/sdk'

export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export type ExtractedLog = {
  events: string
  feelings: string
  achievements: string | null
  difficulties: string | null
  tags: string[]
  summary: string
  mood_score: number  // -2: とても辛い, -1: しんどい, 0: 普通, +1: 良かった, +2: 嬉しい・充実
}

export async function extractLogFromMessages(messages: Message[]): Promise<ExtractedLog> {
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? '親' : 'Yori'}: ${m.content}`)
    .join('\n')

  const extractPrompt = `以下の会話から、今日の記録を抽出してください。

会話:
${conversationText}

以下のJSON形式のみで返してください（説明文は不要）:
{
  "events": "主な出来事を1文で簡潔に（事実ベース）",
  "feelings": "感じた気持ちを1文で簡潔に",
  "achievements": "子どもの成長・できたことがあれば1文で。なければ null",
  "difficulties": "子どもの特性や困りごと（こだわり・感覚過敏・コミュニケーションの難しさ・癇癪・睡眠など）が話題に出ていれば1文で。なければ null",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "summary": "ねぎらいと共感を2文以内で。温かく、簡潔に。",
  "mood_score": 0
}

タグは会話のキーワードを3つ程度（例：発熱、ワンオペ、成長、きょうだい）。
mood_score は会話全体の感情トーンを -2〜+2 の整数で評価する（-2: とても辛い, -1: しんどい, 0: 普通・中立, +1: 良かった, +2: 嬉しい・充実）。`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: extractPrompt }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

  if (!rawText) {
    console.error('Claude extract-log empty response')
    throw new Error('Empty response from Claude')
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Claude extract-log raw text:', rawText)
    throw new Error('No JSON found in Claude response')
  }

  return JSON.parse(jsonMatch[0]) as ExtractedLog
}
