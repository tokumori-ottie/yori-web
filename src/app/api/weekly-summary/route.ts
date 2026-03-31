import { createClient } from '@/lib/supabase/server'
import { generateWeeklySummary, type DailyLogForSummary } from '@/lib/generate-weekly-summary'

function getWeekStartJST(): string {
  const jstDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const jstDate = new Date(jstDateStr + 'T00:00:00')
  const dayOfWeek = jstDate.getDay() // 0=Sun, 1=Mon, ...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  jstDate.setDate(jstDate.getDate() - daysFromMonday)
  return jstDate.toLocaleDateString('sv-SE')
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const weekStart = getWeekStartJST()

  // キャッシュ確認
  const { data: cached } = await supabase
    .from('weekly_summaries')
    .select('content')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

  if (cached) return Response.json({ content: cached.content, weekStart })

  // 週分のログを取得（月〜日）
  const weekEndDate = new Date(weekStart + 'T00:00:00')
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEnd = weekEndDate.toLocaleDateString('sv-SE')

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('date, events, feelings, achievements, tags, mood_score')
    .eq('user_id', user.id)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: true })

  if (!logs || logs.length === 0) {
    return Response.json({ content: null, weekStart })
  }

  try {
    const content = await generateWeeklySummary(logs as DailyLogForSummary[])

    await supabase
      .from('weekly_summaries')
      .upsert({ user_id: user.id, week_start: weekStart, content }, { onConflict: 'user_id,week_start' })

    return Response.json({ content, weekStart })
  } catch (err) {
    console.error('Weekly summary error:', err)
    return new Response('Failed to generate summary', { status: 500 })
  }
}
