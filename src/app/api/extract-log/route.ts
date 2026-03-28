import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { sessionId, messages } = (await request.json()) as {
    sessionId: string
    messages: Message[]
  }

  // セッションの日付を取得
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('date')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

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
  "tags": ["タグ1", "タグ2", "タグ3"]
}

タグは会話から読み取れるキーワード（例：きょうだい、発熱、ワンオペ、怒り、孤独感、など）を3つ程度選んでください。`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: extractPrompt }],
    })

    const rawText =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // JSONを抽出（コードブロックがある場合も対応）
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const extracted = JSON.parse(jsonMatch[0]) as {
      events: string
      feelings: string
      tags: string[]
    }

    // daily_logsに保存（同じ日付があればupsert）
    const { error } = await supabase.from('daily_logs').upsert(
      {
        user_id: user.id,
        session_id: sessionId,
        date: session.date,
        events: extracted.events,
        feelings: extracted.feelings,
        tags: extracted.tags,
      },
      { onConflict: 'user_id,date' }
    )

    if (error) throw error

    return Response.json({ ok: true, extracted })
  } catch (err) {
    console.error('Extract log error:', err)
    return new Response('Failed to extract log', { status: 500 })
  }
}
