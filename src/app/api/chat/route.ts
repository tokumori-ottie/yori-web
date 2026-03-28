import { createClient } from '@/lib/supabase/server'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent'

const SYSTEM_PROMPT = `あなたは「Yori（より）」です。障害のある子どもを育てる親に寄り添うAIコンパニオンです。

【大切にする姿勢】
- 評価・判断をしない
- 解決策を急がない
- 相手が話したいことを話せる空間を作る
- しんどさも、嬉しさも、どちらも同じように受け止める
- 子どもの小さな成長や「できた」出来事を話してくれたときは、一緒に喜ぶ

【応答スタイル】
- 短めの文章で、押しつけがましくなく
- 感情を否定しない
- 「でも」「しかし」で切り返さない
- 専門的なアドバイスや解決策を急いで提示しない
- 敬体（です・ます調）で話す
- 毎回必ず質問で終わらなくていい。「そうなんですね。」「それは嬉しいですね。」のように、ただ受け止めるだけで終わる返しも大切にする
- 質問するとしても、2〜3回に1回程度にとどめる
- 質問するときは一度に一つだけ

【応答の例（良い例）】
- 「何年言っても変わらない、か。それはしんどいですね。」（つらさを受け止める）
- 「いつも、なのですね。ずっと抱えてきたんですね。」（共感で終わる）
- 「はじめてできたんですね。それは嬉しかったですね。」（成長を一緒に喜ぶ）
- 「ずっと待ってきたこと、ですよね。」（積み重ねを認める）

【注意事項】
- 危機的な状況（自傷・他傷の危険）が示唆された場合は、専門機関への相談を優しく勧める
- 医療診断や治療の指示はしない`

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

function calcAge(birthday: string): number {
  const today = new Date()
  const birth = new Date(birthday)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
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

  // プロフィールと子ども情報を取得してシステムプロンプトをパーソナライズ
  const [{ data: profile }, { data: childrenData }] = await Promise.all([
    supabase.from('profiles').select('parent_type').eq('id', user.id).single(),
    supabase.from('children').select('nickname, birthday, gender').eq('user_id', user.id).order('birthday', { ascending: true }),
  ])

  const parentLabel = profile?.parent_type === 'mama' ? 'お母さん' : profile?.parent_type === 'papa' ? 'お父さん' : null

  const childrenContext = childrenData && childrenData.length > 0
    ? childrenData.map((c) => {
        const age = calcAge(c.birthday)
        const genderLabel = c.gender === 'boy' ? '男の子' : c.gender === 'girl' ? '女の子' : 'お子さん'
        return c.nickname ? `${c.nickname}（${age}歳・${genderLabel}）` : `${age}歳の${genderLabel}`
      }).join('、')
    : null

  const personalContext = [parentLabel, childrenContext]
    .filter(Boolean)
    .join(' / お子さん: ')

  const systemPrompt = personalContext
    ? `${SYSTEM_PROMPT}\n\n【話している相手の情報】\n- ${parentLabel ?? 'ご利用者'}さん\n- お子さん: ${childrenContext}`
    : SYSTEM_PROMPT

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
      system_instruction: { parts: [{ text: systemPrompt }] },
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
