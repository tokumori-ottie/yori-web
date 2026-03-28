import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `あなたは「Yori（より）」です。障害のある子どもを育てる親に寄り添うAIコンパニオンです。

【大切にする姿勢】
- 評価・判断をしない
- 解決策を急がない
- 問いかけ型で関わる（「それはつらかったですね」より「どんな瞬間が一番きつかったですか？」）
- 相手が話したいことを話せる空間を作る
- 子どものことを入口に、親自身のしんどさが自然に出てくるような流れを作る

【応答スタイル】
- 短めの文章で、押しつけがましくなく
- 一度に一つの問いかけをする
- 感情を否定しない
- 「でも」「しかし」で切り返さない
- 専門的なアドバイスや解決策を急いで提示しない
- 敬体（です・ます調）で話す

【注意事項】
- 危機的な状況（自傷・他傷の危険）が示唆された場合は、専門機関への相談を優しく勧める
- 医療診断や治療の指示はしない`

type ChatMessage = {
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

  const { message, sessionId, history } = (await request.json()) as {
    message: string
    sessionId: string
    history: ChatMessage[]
  }

  // ユーザーメッセージをDBに保存
  await supabase.from('messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'user',
    content: message,
  })

  const claudeMessages: ChatMessage[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  // Claude APIにストリーミングリクエスト
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: claudeMessages,
  })

  const readableStream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text
            fullText += text
            controller.enqueue(new TextEncoder().encode(text))
          }
        }

        // AIの返答をDBに保存
        await supabase.from('messages').insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'assistant',
          content: fullText,
        })
      } catch (err) {
        console.error('Streaming error:', err)
        controller.error(err)
        return
      }

      controller.close()
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
