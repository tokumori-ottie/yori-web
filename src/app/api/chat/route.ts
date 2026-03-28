import { createClient } from '@/lib/supabase/server'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent'

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

  // Gemini用のメッセージ形式に変換
  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const apiKey = process.env.GEMINI_API_KEY
  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}&alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 1024 },
    }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text()
    console.error('Gemini API error:', errText)
    return new Response('Gemini API error', { status: 500 })
  }

  const readableStream = new ReadableStream({
    async start(controller) {
      let fullText = ''
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const text =
                json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
              if (text) {
                fullText += text
                controller.enqueue(new TextEncoder().encode(text))
              }
            } catch {
              // パースエラーは無視
            }
          }
        }
      } catch (err) {
        console.error('Streaming error:', err)
        controller.error(err)
        return
      }

      // AIの返答をDBに保存
      if (fullText) {
        await supabase.from('messages').insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'assistant',
          content: fullText,
        })
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
