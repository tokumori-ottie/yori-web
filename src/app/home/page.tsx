import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatClient, { type WeekMoodEntry } from './ChatClient'

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

function getTodayJST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function getDateOffset(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}

function getWeekStartJST(): string {
  const jstDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const jstDate = new Date(jstDateStr + 'T00:00:00')
  const dayOfWeek = jstDate.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  jstDate.setDate(jstDate.getDate() - daysFromMonday)
  return jstDate.toLocaleDateString('sv-SE')
}

function computeGreeting(
  hasEndedToday: boolean,
  recentLogs: Array<{ date: string; mood_score: number | null; achievements: string | null }>,
  today: string
): string {
  // 1. すでに今日会話を終えている
  if (hasEndedToday) return 'また話しかけてくれたんだね。続きを聞かせて。'

  // 2. 前日がしんどかった（mood_score ≤ -1）
  const yesterday = getDateOffset(today, -1)
  const yesterdayLog = recentLogs.find((l) => l.date === yesterday)
  if (yesterdayLog && yesterdayLog.mood_score !== null && yesterdayLog.mood_score <= -1) {
    return '昨日は大変だったね。今日はどう？'
  }

  // 3. 直近7日間に子どもの成長・できたことが記録されている
  const recentWithAchievement = recentLogs.find((l) => l.achievements)
  if (recentWithAchievement) {
    return '最近、できたことを話してくれてたね。今日はどんな一日だった？'
  }

  // 4. 3日以上ログが空いている（またはログが一度もない）
  if (recentLogs.length === 0) return '久しぶり。最近どうしてた？'
  const latestMs = new Date(recentLogs[0].date + 'T00:00:00').getTime()
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const daysDiff = Math.floor((todayMs - latestMs) / (1000 * 60 * 60 * 24))
  if (daysDiff >= 3) return '久しぶり。最近どうしてた？'

  // 5. デフォルト
  return '今日はどんな一日でしたか？'
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
  const sevenDaysAgo = getDateOffset(today, -7)
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
      // 直近7日間のログ（挨拶文脈判定用）
      supabase
        .from('daily_logs')
        .select('date, mood_score, achievements')
        .eq('user_id', user.id)
        .gte('date', sevenDaysAgo)
        .order('date', { ascending: false })
        .limit(5),
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
  const greeting = computeGreeting(hasEndedToday, recentLogs ?? [], today)
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
