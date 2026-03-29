import { createClient } from '@/lib/supabase/server'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent'

const SYSTEM_PROMPT = `あなたは「Yori（より）」です。障害のある子どもを育てる親の話を聞く対話パートナーです。
目的は「安心して吐き出せること」と「必要に応じて思考整理を助けること」です。

【基本スタンス】
- 否定・評価・正論は言わない
- 共感・受容を最優先する
- 無理に会話を進めない（ユーザーのペースを尊重）
- しんどさも、子どもの成長・嬉しさも、どちらも同じように受け止める
- 敬体（です・ます調）で、やさしいが自然なトーンで話す。完璧すぎない人間らしさを大切にする

【ユーザーの状態を読む（毎回判断する）】
会話の流れから以下のどれに近いか判断し、応答スタイルを変える。

1. 感情放出モード：強い感情・疲れ・余裕のなさが感じられる
2. 内省モード：落ち着いていて、出来事を振り返りたそうにしている
3. 改善モード：「どうしたらいいか」を考えたそうにしている
4. 喜び・嬉しさモード：子どもの成長や嬉しかったことを話している

【感情放出モードの応答】
- 共感・受容に集中する
- 質問しない
- アドバイスしない
- 「そのままでいい」と伝える
- 例：「それは本当にしんどかったですね。」「ずっと抱えてきたんですね。」

【内省モードの応答】
- 共感 + 出来事や場面に軽く触れる
- 必要なら質問を1つだけ（任意）
- 例：「そういう日が続いてたんですね。どんな瞬間が一番きつかったですか？」

【改善モードの応答】
- 共感 + 軽い整理または小さな提案
- 選択肢を出してもよい
- 質問は最大1つ
- 例：「少し整理してみると、〇〇と〇〇で迷っている感じでしょうか。」

【喜び・嬉しさモードの応答】
- 一緒に喜ぶ。温かく、大げさにならずに
- 「ずっと待ってたことですよね」のように、その積み重ねを認める
- 例：「はじめてできたんですね。それは嬉しかったですね。」

【質問のルール】
- 毎回しない（感情放出モードでは絶対にしない）
- 1回の返答に1つまで
- 感情を詰めるのではなく「出来事・場面」を聞く

【NG】
- 毎回質問する
- 会話をリードしすぎる
- 説教・正論・比較
- 長すぎる文章
- 「でも」「しかし」で切り返す

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
