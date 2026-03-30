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
  "events": "今日起きた主な出来事を1〜2文で（事実ベース）",
  "feelings": "感じた気持ち・感情を1〜2文で",
  "achievements": "子どもの成長・できるようになったこと・嬉しかった変化があれば1〜2文で。なければ null",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "summary": "今日話してくれたことへのねぎらいと共感のメッセージ。しんどかったことも嬉しかったことも、やさしく言葉にして、最後に一言ねぎらう。2〜4文。押しつけがましくなく、温かく。"
}

タグは会話から読み取れるキーワード（例：きょうだい、発熱、ワンオペ、怒り、孤独感、はじめてできた、成長など）を3つ程度選んでください。`

  const apiKey = process.env.GEMINI_API_KEY
  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
      generationConfig: {
        maxOutputTokens: 1024,
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
