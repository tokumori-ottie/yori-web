const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export type ExtractedLog = {
  events: string
  feelings: string
  achievements: string | null
  tags: string[]
  summary: string
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
  "tags": ["タグ1", "タグ2", "タグ3"],
  "summary": "ねぎらいと共感を2文以内で。温かく、簡潔に。"
}

タグは会話のキーワードを3つ程度（例：発熱、ワンオペ、成長、きょうだい）。`

  const apiKey = process.env.GEMINI_API_KEY
  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
      generationConfig: {
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  })

  const json = await res.json()
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  if (!rawText) {
    console.error('Gemini extract-log empty response:', JSON.stringify(json))
    throw new Error('Empty response from Gemini')
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('Gemini extract-log raw text:', rawText)
    throw new Error('No JSON found in Gemini response')
  }

  return JSON.parse(jsonMatch[0]) as ExtractedLog
}
