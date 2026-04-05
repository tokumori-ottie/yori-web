import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatClient, { type WeekMoodEntry } from './ChatClient'

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function getTodayJST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function getWeekStartJST(): string {
  const jstDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const jstDate = new Date(jstDateStr + 'T00:00:00')
  const dayOfWeek = jstDate.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  jstDate.setDate(jstDate.getDate() - daysFromMonday)
  return jstDate.toLocaleDateString('sv-SE')
}

type RecentLog = {
  date: string
  mood_score: number | null
  events: string | null
  feelings: string | null
  achievements: string | null
  difficulties: string | null
  tags: string[]
}

async function generateGreeting(recentLogs: RecentLog[], today: string): Promise<string> {
  if (recentLogs.length === 0) return '今日はどんな一日でしたか？'

  const latestMs = new Date(recentLogs[0].date + 'T00:00:00').getTime()
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const daysDiff = Math.floor((todayMs - latestMs) / (1000 * 60 * 60 * 24))

  // 1週間以上空いていたら、ログ内容より「久しぶり感」を優先
  if (daysDiff >= 7) return '久しぶり。最近どうしてた？'

  const logsText = recentLogs
    .map((log) => {
      const d = new Date(log.date + 'T00:00:00')
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const parts: string[] = []
      if (log.events) parts.push(`出来事：${log.events}`)
      if (log.feelings) parts.push(`気持ち：${log.feelings}`)
      if (log.achievements) parts.push(`できたこと：${log.achievements}`)
      if (log.difficulties) parts.push(`困りごと：${log.difficulties}`)
      if (log.tags.length > 0) parts.push(`タグ：${log.tags.join('、')}`)
      const moodLabel =
        log.mood_score === null
          ? ''
          : ['とても辛い', 'しんどい', 'ふつう', '良かった', '嬉しい・充実'][log.mood_score + 2]
      return `【${label}${moodLabel ? ` (${moodLabel})` : ''}】\n${parts.join('\n') || '記録なし'}`
    })
    .join('\n\n')

  const gapNote = daysDiff >= 3 ? `\n※ 最後の記録から${daysDiff}日経っています。` : ''

  const prompt = `あなたは、障害のある子どもを育てる親のそばにいるAIコンパニオン「Yori」です。
今日アプリを開いた親に、最初のひとことを届けます。${gapNote}

以下は最近の記録です：
${logsText}

この記録を読んで、今日の最初のメッセージを1〜2文で作ってください。

## 条件
- 記録にある具体的な出来事・気持ち・困りごとに触れ、「その後どうだった？」「大丈夫だった？」という問いかけや確認をする
- しんどそうな日が続いていたら心配する、良いことがあったなら続きを聞きたがる
- 自然なため口（「〜だったね」「どうだった？」）
- 押しつけがましくない、さりげない1〜2文のみ
- 説明や前置き不要。メッセージ本文だけ返す`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    return text || '今日はどんな一日でしたか？'
  } catch {
    // API失敗時はフォールバック
    return '今日はどんな一日でしたか？'
  }
}

function buildWeekMoodChart(
  weekLogs: Array<{ date: string; mood_score: number | null }>,
  weekStart: string,
  today: string
): WeekMoodEntry[] {
  const result: WeekMoodEntry[] = []
  const todayTime = new Date(today + 'T00:00:00').getTime()

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + i)
    if (d.getTime() > todayTime) break
    const dateStr = d.toLocaleDateString('sv-SE')
    const log = weekLogs.find((l) => l.date === dateStr)
    result.push({ date: dateStr, day: DAY_NAMES[d.getDay()], score: log?.mood_score ?? null })
  }
  return result
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('parent_type')
    .eq('id', user.id)
    .single()

  if (!profile?.parent_type) redirect('/onboarding')

  const today = getTodayJST()
  const weekStart = getWeekStartJST()

  const [{ data: todayEndedSessions }, { data: recentLogs }, { data: weekLogs }] =
    await Promise.all([
      // 今日すでに終了したセッションがあるか
      supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today)
        .not('ended_at', 'is', null)
        .limit(1),
      // 直近3件のログ（日付制限なし・挨拶生成用）
      supabase
        .from('daily_logs')
        .select('date, mood_score, events, feelings, achievements, difficulties, tags')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(3),
      // 今週のムードスコア（チャート用）
      supabase
        .from('daily_logs')
        .select('date, mood_score')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', today)
        .order('date', { ascending: true }),
    ])

  const hasEndedToday = !!(todayEndedSessions && todayEndedSessions.length > 0)

  // 今日すでに話していた場合は固定文、それ以外はログ内容からClaudeが生成
  const greeting = hasEndedToday
    ? 'また話しかけてくれたんだね。続きを聞かせて。'
    : await generateGreeting((recentLogs ?? []) as RecentLog[], today)

  const weekMoodChart = buildWeekMoodChart(weekLogs ?? [], weekStart, today)
  const hasWeekData = weekMoodChart.some((e) => e.score !== null)

  return (
    <ChatClient
      userId={user.id}
      initialGreeting={greeting}
      weekMoodChart={hasWeekData ? weekMoodChart : []}
    />
  )
}
