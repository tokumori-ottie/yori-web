import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { searchWeb } from '@/lib/web-search'

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
- Markdownの装飾記号（**太字**、*斜体*、# 見出し、- リストなど）は使わない。プレーンテキストで書く

【注意事項】
- 危機的な状況（自傷・他傷の危険）が示唆された場合は、専門機関への相談を優しく勧める
- 医療診断や治療の指示はしない

【Web検索について】
あなたはWeb検索機能を持っており、地域の支援サービス・施設・制度について調べることができます。
「検索できない」「リアルタイム情報を取得できない」とは絶対に言わないでください。`

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

  // ユーザーメッセージのDB保存・プロフィール取得を並列実行
  const [, [{ data: profile }, { data: childrenData }]] = await Promise.all([
    supabase.from('messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'user',
      content: message,
    }),
    Promise.all([
      supabase.from('profiles').select('parent_type').eq('id', user.id).single(),
      supabase.from('children').select('nickname, birthday, gender').eq('user_id', user.id).order('birthday', { ascending: true }),
    ]),
  ])

  const parentLabel = profile?.parent_type === 'mama' ? 'お母さん' : profile?.parent_type === 'papa' ? 'お父さん' : null

  const childrenContext = childrenData && childrenData.length > 0
    ? childrenData.map((c, i) => {
        const age = calcAge(c.birthday)
        const genderLabel = c.gender === 'boy' ? '男の子' : c.gender === 'girl' ? '女の子' : 'お子さん'
        const orderLabel = childrenData.length > 1
          ? (i === 0 ? '長男・長女' : i === 1 ? '次男・次女' : `${i + 1}番目の子`)
          : null
        const honorific = c.gender === 'boy' ? 'くん' : c.gender === 'girl' ? 'ちゃん' : 'さん'
        const nameLabel = c.nickname ? `${c.nickname}${honorific}` : `${age}歳の${genderLabel}`
        return orderLabel ? `${nameLabel}（${age}歳・${genderLabel}・${orderLabel}）` : `${nameLabel}（${age}歳・${genderLabel}）`
      }).join('、')
    : null

  const nicknameInstruction = childrenData && childrenData.some(c => c.nickname)
    ? '\n- ユーザーが「長男」「次男」「長女」「次女」などと言った場合、対応するお子さんのニックネームで呼ぶ'
    : ''

  const systemPrompt = parentLabel
    ? `${SYSTEM_PROMPT}${nicknameInstruction}\n\n【話している相手の情報】\n- ${parentLabel}さん\n- お子さん: ${childrenContext}`
    : SYSTEM_PROMPT

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const anthropicMessages = [
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ]

  // フェーズ1: 検索が必要かどうかを判定（直近の会話履歴も渡して文脈を把握させる）
  const intentCheck = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    system: `会話の流れを見て、Web検索が必要かどうかだけを判定してください。
以下の場合のみ SEARCH と答えてください：
- 地域の支援サービス・相談窓口・施設を探している
- 制度・補助金・手続きなど最新情報が必要
- 特定の療法・支援方法について詳しく調べたい
- 「調べて」「検索して」「教えて」など調査を依頼している（前の文脈で話題になっていたものを検索）

感情の吐き出し・近況報告・悩みの共有は必ず NO_SEARCH。
一般的な発達障害の特性などの基本知識も NO_SEARCH（Claudeが答えられるため）。

必ず以下の形式のみで答えてください：
SEARCH: <日本語の検索クエリ>
または
NO_SEARCH`,
    messages: anthropicMessages.slice(-5),
  })

  const intentText =
    intentCheck.content[0].type === 'text' ? intentCheck.content[0].text.trim() : 'NO_SEARCH'

  console.log('[search] intentText:', intentText)
  console.log('[search] TAVILY_API_KEY set:', !!process.env.TAVILY_API_KEY)

  // フェーズ2: 必要なら検索してsystem promptに注入
  let systemFinal = systemPrompt
  if (intentText.startsWith('SEARCH:')) {
    const query = intentText.replace('SEARCH:', '').trim()
    console.log('[search] query:', query)
    const results = await searchWeb(query)
    console.log('[search] results count:', results.length)
    if (results.length > 0) {
      const context = results
        .map((r) => `・${r.title}\n${r.content.slice(0, 200)}`)
        .join('\n\n')
      systemFinal = `${systemPrompt}\n\n【Web検索で取得した最新情報】\n${context}\n\n上記の検索結果を使って、施設名・サービス名・連絡先など具体的な情報をYoriのやさしいトーンでお伝えください。情報が見つかった場合は「調べてみました」と自然に伝えてください。`
    }
  }

  const stream = client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemFinal,
    messages: anthropicMessages,
  })

  const readableStream = new ReadableStream({
    async start(controller) {
      let fullText = ''
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullText += event.delta.text
            controller.enqueue(new TextEncoder().encode(event.delta.text))
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
